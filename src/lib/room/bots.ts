// Bots: pretend phones the host screen runs, for playtesting a room without a phone for every
// seat. Each bot sits in a local seat of the room link (host-link `seat`): it joins under the
// game's own rules, is sent exactly the view a phone would be sent, and acts by sending the
// messages a phone would, which the host checks like any phone's. What a bot does is its game's
// brain (`games/<id>/bot.ts`); this file times it, names it and seats it again after a host
// reload. The game's own saved players are the record: a bot is a player whose name carries the mark.
// Today's brains are simple (random choices, stock lines); a smarter one only has to implement
// `Brain`.
import { BOT_MARK, type HostLink, type LocalSeat } from './host-link.svelte';
import { newPid } from './code';

/** Every view carries the time left on its timer (ms, or null) and whether the game is paused. */
export interface BotView { left: number | null; paused: boolean }

/** What a brain sees each time it looks at its phone. */
export interface Look<V> {
  view: V;
  /** The bot's own player id. */
  me: string;
  /** Time left on the view's timer now (ms), or null when untimed. */
  left: number | null;
  /** The bot's own random numbers (seeded from its id). */
  rand: () => number;
  /** The bot's memory, kept for as long as the host screen stays open. */
  mem: Record<string, unknown>;
}

/**
 * What a brain wants to do next: send `act()`'s messages after `wait` ms, if it still wants the
 * same `key` then. The key names the job (a prompt, a vote): the wait is not restarted while the
 * key stays the same, and a job done is not done again unless the host refuses it.
 */
export interface Plan { key: string; wait: number; act: () => object[] }

export interface Brain<V extends BotView> {
  /** The next thing to do on this view, or null to wait. */
  decide(look: Look<V>): Plan | null;
  /** Any other message from the host (a drawing, a request for live ink). */
  hear?(msg: { t: string; [k: string]: unknown }, mem: Record<string, unknown>): void;
}

/** A job sent but still asked for this long after is tried again (the host refused it, or it was lost). */
const RETRY_MS = 8000;
const BEAT_MS = 1000;

// --- think times (*house*) ---

/** Never past this close to the timer's end. */
const MARGIN_MS = 800;
/** A wait, cut short to end before the timer does (`left` null: untimed). */
const beforeEnd = (wait: number, left: number | null) => (left === null ? wait : Math.max(300, Math.min(wait, left - MARGIN_MS)));

/** Voting or picking: 1–4 s, always before the timer ends. */
export const quick = (rand: () => number, left: number | null) => beforeEnd(1000 + Math.round(rand() * 3000), left);

/**
 * Writing or drawing: from a few seconds to a good part of the time left, always ending before
 * the timer does (untimed: 3–10 s). Never instant.
 */
export function slow(rand: () => number, left: number | null): number {
  if (left === null) return 3000 + Math.round(rand() * 7000);
  const latest = left - 2500;
  if (latest < 1500) return beforeEnd(1000, left);
  const earliest = Math.min(3000, latest);
  return Math.round(earliest + rand() * (Math.max(earliest, latest * 0.6) - earliest));
}

/** Random numbers from a seed (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (s: string) => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);

export const pickOne = <T>(items: readonly T[], rand: () => number): T => items[Math.floor(rand() * items.length)];

// --- names ---

const NAMES = ['Ada', 'Bix', 'Cog', 'Dot', 'Echo', 'Fizz', 'Gus', 'Hex', 'Ivy', 'Jinx', 'Kit', 'Lux'];

/** A bot's name, new in the room: "🤖 Ada", "🤖 Bix", then "🤖 Ada 2". */
export function botName(taken: readonly string[]): string {
  const used = new Set(taken.map((n) => n.toLowerCase()));
  for (let round = 1; ; round++) {
    for (const n of NAMES) {
      const name = `${BOT_MARK} ${n}${round > 1 ? ` ${round}` : ''}`;
      if (!used.has(name.toLowerCase())) return name;
    }
  }
}

export const isBot = (name: string) => name.startsWith(BOT_MARK);

// --- one bot ---

/** One bot: reads what its seat is sent and acts on its brain's plans, never while paused. */
export class Bot<V extends BotView> implements LocalSeat {
  private view: V | null = null;
  private viewAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: string | null = null;
  private done = new Map<string, number>();
  private beat: ReturnType<typeof setInterval> | null = null;
  private mem: Record<string, unknown> = {};
  readonly rand: () => number;

  constructor(readonly pid: string, readonly name: string, private brain: Brain<V>,
    private send: (msg: object) => void, private gone: (pid: string) => void) {
    this.rand = seeded(hash(pid));
  }

  deliver(msg: { t: string; [k: string]: unknown }): void {
    if (msg.t === 'reject' || msg.t === 'ended') return this.stop(true);
    if (msg.t === 'view') {
      this.view = msg.v as V;
      this.viewAt = Date.now();
      this.beat ??= setInterval(() => this.think(), BEAT_MS);
    } else if (msg.t !== 'welcome' && msg.t !== 'ping') this.brain.hear?.(msg, this.mem);
    this.think();
  }

  /** Stops thinking; `out`: the room let it go (removed, or closed). */
  stop(out = false): void {
    this.cancel();
    if (this.beat) clearInterval(this.beat);
    this.beat = null;
    this.view = null;
    if (out) this.gone(this.pid);
  }

  private look(): Look<V> | null {
    const v = this.view;
    if (!v || v.paused) return null;
    const left = v.left === null ? null : Math.max(0, v.left - (Date.now() - this.viewAt));
    return { view: v, me: this.pid, left, rand: this.rand, mem: this.mem };
  }

  private plan(): Plan | null {
    const look = this.look();
    const plan = look && this.brain.decide(look);
    if (!plan) return null;
    const at = this.done.get(plan.key);
    if (at !== undefined && Date.now() - at < RETRY_MS) return null;
    return plan;
  }

  private cancel(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }

  private think(): void {
    const plan = this.plan();
    if (!plan) return this.cancel();
    if (plan.key === this.pending) return;
    this.cancel();
    this.pending = plan.key;
    this.timer = setTimeout(() => this.fire(plan.key), Math.max(200, plan.wait));
  }

  private fire(key: string): void {
    this.timer = null;
    this.pending = null;
    const plan = this.plan(); // the view as it is now: paused, or moved on, means not this
    if (plan?.key === key) {
      this.done.set(key, Date.now());
      for (const [k, t] of this.done) if (Date.now() - t > 10 * RETRY_MS) this.done.delete(k);
      for (const m of plan.act()) this.send(m);
    }
    this.think();
  }
}

// --- the room's bots ---

/** A player as the game records them; `out` when removed or gone. */
export interface Seat { pid: string; name: string; out?: boolean }

/** The bots in one game's room: added from the lobby, seated again when a reloaded host reopens the room. */
export class Bots<V extends BotView> {
  private bots = new Map<string, Bot<V>>();

  constructor(private link: HostLink, private brain: () => Brain<V>,
    /** Everyone in the game now, as the game records them. */
    private players: () => Seat[],
    /** Takes a bot out of the game when it can no longer be seated. */
    private lost: (pid: string) => void) {}

  /** Adds a bot to the room; null, or why it could not join (room full, game started…). */
  add(): string | null {
    const res = this.seat(newPid(), botName(this.players().map((p) => p.name)));
    return 'error' in res ? res.error : null;
  }

  /** The room (re)opened: seats every bot the game has, with its id and name; one refused leaves the game. */
  open(): void {
    for (const p of this.players()) {
      if (p.out || !isBot(p.name) || this.bots.has(p.pid)) continue;
      if ('error' in this.seat(p.pid, p.name)) this.lost(p.pid);
    }
  }

  /** The room closed (the link has told every bot): stop them. */
  close(): void {
    for (const b of this.bots.values()) b.stop();
    this.bots.clear();
  }

  private seat(pid: string, name: string): { pid: string } | { error: string } {
    const bot = new Bot<V>(pid, name, this.brain(), (m) => this.link.act(pid, m), (gone) => this.bots.delete(gone));
    const res = this.link.seat(pid, name, bot);
    if ('error' in res) bot.stop();
    else this.bots.set(pid, bot);
    return res;
  }
}
