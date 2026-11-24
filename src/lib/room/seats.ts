// Who may sit where in an own-phones room. Each seat has a key that its phone made for this room;
// a phone coming back proves it has the key (an HMAC over a one-time value and the connection's
// own certificates, so it is no use on any other connection) and never sends it again. A phone
// that cannot prove a seat gets it only through recovery, which the host starts for that one seat.
// The room link (host-link, phone-link) carries the messages; everything about seats is decided here.
import { load, remove, save, trySave } from '../storage';

// --- keys and proofs ---

const hex = (bytes: Uint8Array): string => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
/** 128 random bits in hex: a seat's key, a room's id, a one-time value. */
export const newKey = (): string => hex(crypto.getRandomValues(new Uint8Array(16)));
export const isKey = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-f]{32}$/.test(x);

interface Described { currentLocalDescription?: { sdp: string } | null; currentRemoteDescription?: { sdp: string } | null }
/** Every certificate fingerprint a side's description names (a forged second one changes the whole). */
const prints = (d?: { sdp: string } | null): string =>
  [...new Set([...(d?.sdp ?? '').matchAll(/^a=fingerprint:(.*)$/gim)].map((m) => m[1].trim().toLowerCase()))].sort().join(',');
/** This connection's two ends, as WebRTC itself agreed them: what a proof is good for. Empty where there is none (tests). */
export const ends = (pc: Described | undefined): { here: string; there: string } =>
  ({ here: prints(pc?.currentLocalDescription), there: prints(pc?.currentRemoteDescription) });

/** What a proof is for: this room, this one-time value, and the channel between this host and this phone. */
export interface Challenge { room: string; nonce: string; host: string; phone: string }

/** Proof of having `key`; empty without a key or without crypto.subtle (plain http). */
export async function proofOf(key: string | undefined, c: Challenge): Promise<string> {
  if (!key || !globalThis.crypto?.subtle) return '';
  const bytes = (s: string) => new TextEncoder().encode(s);
  try {
    const k = await crypto.subtle.importKey('raw', bytes(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return hex(new Uint8Array(await crypto.subtle.sign('HMAC', k, bytes(JSON.stringify([c.room, c.nonce, c.host, c.phone])))));
  } catch { return ''; }
}

/** What a phone shows, in its own words, while the host is asked about it. */
export const WAITING = 'Waiting for a Yes on the host screen.';
/** What a phone shows, in its own words, when it cannot take its seat by itself. */
export const ASK_HOST = 'This phone can’t take that seat by itself. Ask the host to tap New phone and pick your name, then join again.';

type Pair = [string, string];
const pairs = (x: unknown, ok: (p: Pair) => boolean): Pair[] =>
  Array.isArray(x) ? x.filter((p): p is Pair => Array.isArray(p) && p.length === 2 && ok(p as Pair)) : [];

// --- the phone's keys ---

const RING_MAX = 200;
const KEYS_EACH = 2;

/**
 * A phone's keys in one game: the two newest of each room (an enrolment cut short leaves the one
 * before usable), oldest first. Kept in memory where storage is blocked.
 */
export class KeyRing {
  private held: Pair[] = [];
  constructor(private game: string) {}

  get(room: string): string[] {
    return this.all().filter(([r]) => r === room).map(([, key]) => key);
  }

  /** A new key for the room. */
  make(room: string): string {
    const key = newKey();
    const before = this.get(room).slice(1 - KEYS_EACH).map((k): Pair => [room, k]);
    const all = [...this.all().filter(([r]) => r !== room), ...before, [room, key] as Pair].slice(-RING_MAX);
    this.held = trySave(`${this.game}:keys`, all) ? [] : all;
    return key;
  }

  private all(): Pair[] { return this.held.length ? this.held : this.saved(); }

  private saved(): Pair[] {
    return pairs(load<unknown>(`${this.game}:keys`, null), ([r, k]) => isKey(r) && isKey(k));
  }
}

// --- the host's record ---

const isPid = (x: unknown): x is string => typeof x === 'string' && x.length <= 64;

/** The room's id, its seats' keys and who was removed: saved beside the game, never part of it. */
export class SeatBook {
  room = newKey();
  private keys = new Map<string, string>();
  private out = new Set<string>();
  constructor(private game: string) {}

  /** The room opens; `room`: the id saved with its game. No record of that very room: a new id, and no seat has a key. */
  open(room: string): void {
    const s = load<{ room?: unknown; keys?: unknown; kicked?: unknown } | null>(`${this.game}:seats`, null);
    const saved = s && isKey(s.room) && s.room === room ? s : null;
    this.room = saved ? (saved.room as string) : newKey();
    this.keys = new Map(pairs(saved?.keys, ([pid, key]) => isPid(pid) && isKey(key)));
    this.out = new Set(Array.isArray(saved?.kicked) ? saved.kicked.filter(isPid) : []);
    this.save();
  }

  key(pid: string): string | undefined { return this.keys.get(pid); }
  kicked(pid: string): boolean { return this.out.has(pid); }

  /** The seat's only key from now on; none: the seat has no key (its phone is an old page). */
  bind(pid: string, key: string | undefined): void {
    if (key) this.keys.set(pid, key);
    else this.keys.delete(pid);
    this.save();
  }

  kick(pid: string): void {
    this.keys.delete(pid);
    this.out.add(pid);
    this.save();
  }

  /** The empty room moves to another code: a room of its own from now on. */
  fork(): void {
    this.clear();
    this.save();
  }

  close(): void {
    this.clear();
    remove(`${this.game}:seats`);
  }

  private clear(): void {
    this.room = newKey();
    this.keys.clear();
    this.out.clear();
  }

  /** The old record goes first: where a new one will not fit, no seat trusts an old key. */
  private save(): void {
    remove(`${this.game}:seats`);
    save(`${this.game}:seats`, { room: this.room, keys: [...this.keys], kicked: [...this.out] });
  }
}

// --- the rules ---

export const REMOVED = 'The host removed you from this room.';
const SAID_NO = 'The host said no.';
const NO_ANSWER = 'The host did not answer. Try again.';
const TWO = 'Another phone asked for that seat too. Ask the host to try again.';
const CHANGED = 'The room changed while you waited. Join again.';

/** How long a seat stays open for a new phone once the host opens it. */
export const OPEN_MS = 60_000;

interface Row { pid: string; name: string }
/** The seat a game gives a phone: its player, and whether it is new to the game. `then`: what to do once it is welcomed. */
export interface Seat extends Row { fresh: boolean; then: () => void }

/** The seat a game's join rules gave: whose it is, and whether the game already had that player. */
export const seatIn = (players: readonly Row[], joined: { pid: string; game: { players: readonly Row[] } }): Omit<Seat, 'then'> => ({
  pid: joined.pid,
  name: joined.game.players.find((p) => p.pid === joined.pid)?.name ?? '',
  fresh: !players.some((p) => p.pid === joined.pid),
});

/** `modern`: its page can do keys. `approved`: the host said Yes to this connection. */
export interface Claim { modern: boolean; proof: 'none' | 'right' | 'wrong'; approved: boolean }
/** 'recover': only through recovery the host has opened for the seat. */
export type Step = 'admit' | 'enrol' | 'prove' | 'recover';

/** What happens next to a phone asking for a seat: a seat with a key wants its proof; a seat the game already had wants the host. */
export function nextStep(c: Claim, s: { keyed: boolean; fresh: boolean }): Step {
  if (c.approved) return c.modern ? 'enrol' : 'admit';
  if (s.keyed) return !c.modern || c.proof === 'wrong' ? 'recover' : c.proof === 'none' ? 'prove' : 'admit';
  if (!s.fresh) return 'recover';
  return c.modern ? 'enrol' : 'admit';
}

/**
 * What the host screen shows of recovery: open for `name`'s seat (`asking`: one phone asks for
 * it now), or, with a `note`, closed without giving it to anyone.
 */
export interface Recovery { pid: string; name: string; asking: boolean; note: string }

interface Call<C> extends Claim {
  conn: C;
  pid: string;
  name: string;
  /** The seat it asks for, once the game has said. */
  seat: string;
  /** What it was last sent and may answer now ('check': its proof is being checked). */
  stage: '' | 'prove' | 'check' | 'enrol' | 'ask';
  /** The one-time value its proof is for. */
  nonce: string;
}

interface Open<C> { pid: string; name: string; asker: Call<C> | null; timer: ReturnType<typeof setTimeout> }

export interface DeskHooks<C> {
  resolve(pid: string, name: string): Seat | { error: string };
  /** The connection's ends (this host's, the phone's). */
  ends(conn: C): { here: string; there: string };
  send(conn: C, msg: object): void;
  /** Says why, and closes; `ask`: the phone shows its own words for "ask the host". */
  refuse(conn: C, why: string, ask?: boolean): void;
  admit(conn: C, seat: Seat): void;
  show(now: Recovery | null): void;
}

/** Phones that have said hello and have no seat yet, and the one seat the host may have opened for a new phone. */
export class Desk<C> {
  private calls = new Map<C, Call<C>>();
  private open: Open<C> | null = null;
  private closed: Recovery | null = null;
  constructor(private book: SeatBook, private hooks: DeskHooks<C>) {}

  hello(conn: C, pid: string, name: string, modern: boolean): void {
    if (this.calls.has(conn)) return;
    const call: Call<C> = { conn, pid, name, modern, proof: 'none', approved: false, seat: '', stage: '', nonce: '' };
    this.calls.set(conn, call);
    this.advance(call);
  }

  async proof(conn: C, macs: unknown): Promise<void> {
    const call = this.calls.get(conn);
    if (call?.stage !== 'prove' || !Array.isArray(macs) || macs.length > KEYS_EACH) return;
    call.stage = 'check';
    const key = this.book.key(call.seat);
    const { here, there } = this.hooks.ends(conn);
    const want = await proofOf(key, { room: this.book.room, nonce: call.nonce, host: here, phone: there });
    if (this.calls.get(conn) !== call) return; // meanwhile it closed, or the room moved
    call.proof = want !== '' && macs.includes(want) && this.book.key(call.seat) === key ? 'right' : 'wrong';
    this.advance(call);
  }

  key(conn: C, key: unknown): void {
    const call = this.calls.get(conn);
    if (call?.stage === 'enrol' && isKey(key)) this.advance(call, key);
  }

  /** The host opens one seat for a new phone, for a minute; any seat open before closes. */
  recover(pid: string, name: string): void {
    this.close('', SAID_NO);
    const timer = setTimeout(() => { if (this.open === open) this.close(`No phone took ${name}’s seat in time. Try again.`, NO_ANSWER); }, OPEN_MS);
    const open: Open<C> = { pid, name, asker: null, timer };
    this.open = open;
    this.closed = null;
    this.show();
  }

  /** The host's answer for the one phone asking: Yes is for that connection alone. */
  answer(yes: boolean): void {
    const asker = this.open?.asker;
    if (!asker) return;
    this.close('', yes ? undefined : SAID_NO);
    if (!yes) return;
    asker.approved = true;
    this.advance(asker);
  }

  /** The host closes recovery, or puts away its note. */
  stop(): void {
    this.close('', SAID_NO);
    this.closed = null;
    this.show();
  }

  /** Waiting for the host: no other clock runs meanwhile. */
  asking(conn: C): boolean { return this.calls.get(conn)?.stage === 'ask'; }

  /** The connection is gone, or may not go on; whatever the host said to it is gone too. */
  drop(conn: C): void {
    const call = this.calls.get(conn);
    this.calls.delete(conn);
    if (call && this.open?.asker === call) this.close(`The phone asking for ${this.open.name}’s seat went away. Try again.`);
  }

  /** The host removed this player: whoever is asking for the seat is out too. */
  kick(pid: string): void {
    if (this.open?.pid === pid) this.close('', REMOVED);
    for (const c of this.calls.values()) if (c.seat === pid || c.pid === pid) this.refuse(c, REMOVED);
  }

  /** The room moves or changes broker: every phone asks again. */
  clear(): void {
    if (this.open) clearTimeout(this.open.timer);
    this.open = null;
    this.closed = null;
    this.calls.clear();
    this.show();
  }

  /** The next step for a phone, on the room as it is now; `key`: the one it just made for its seat. */
  private advance(call: Call<C>, key?: string): void {
    const seat = this.hooks.resolve(call.pid, call.name);
    if ('error' in seat) return this.refuse(call, seat.error);
    if (call.seat && call.seat !== seat.pid) return this.refuse(call, CHANGED);
    call.seat = seat.pid;
    const step = nextStep(call, { keyed: this.book.key(seat.pid) !== undefined, fresh: seat.fresh });
    if (step === 'prove') return this.prove(call);
    if (step === 'recover') return this.ask(call);
    if (step === 'enrol' && !key) return this.enrol(call);
    if (key || call.approved) this.book.bind(seat.pid, key);
    this.calls.delete(call.conn);
    this.hooks.admit(call.conn, seat);
  }

  private prove(call: Call<C>): void {
    call.stage = 'prove';
    call.nonce = newKey();
    this.hooks.send(call.conn, { t: 'prove', room: this.book.room, nonce: call.nonce });
  }

  private enrol(call: Call<C>): void {
    call.stage = 'enrol';
    this.hooks.send(call.conn, { t: 'enrol', room: this.book.room });
  }

  /** Only the seat the host opened may be asked for, by one connection; a second one closes it for both. */
  private ask(call: Call<C>): void {
    const open = this.open;
    if (open?.pid !== call.seat) return this.refuse(call, ASK_HOST, true);
    if (open.asker && open.asker !== call) {
      this.close(`Two phones asked for ${open.name}’s seat, so neither got it. Try again.`, TWO);
      return this.refuse(call, TWO);
    }
    open.asker = call;
    call.stage = 'ask';
    this.hooks.send(call.conn, { t: 'wait' });
    this.show();
  }

  /** Recovery ends: `note` for the host, `why` for the phone that was asking. */
  private close(note: string, why?: string): void {
    const open = this.open;
    if (!open) return;
    clearTimeout(open.timer);
    this.open = null;
    this.closed = note ? { pid: open.pid, name: open.name, asking: false, note } : null;
    if (open.asker && why) this.refuse(open.asker, why);
    this.show();
  }

  private refuse(call: Call<C>, why: string, ask = false): void {
    this.drop(call.conn);
    this.hooks.refuse(call.conn, why, ask);
  }

  private show(): void {
    const o = this.open;
    this.hooks.show(o ? { pid: o.pid, name: o.name, asking: !!o.asker, note: '' } : this.closed);
  }
}
