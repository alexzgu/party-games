// Who may sit where in an own-phones room. Each seat has a key that its phone made for this room;
// a phone coming back proves it has the key (an HMAC over a one-time number and the connection's
// own certificates, so it is no use on any other connection) and never sends it again. Where there is no key to prove, the host is asked. The room link (host-link, phone-link)
// carries the messages; everything decided about seats is decided here.
import { load, remove, save, trySave } from '../storage';

// --- keys and proofs ---

const hex = (bytes: Uint8Array): string => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
/** 128 random bits in hex: a seat's key, a room's id, a one-time number. */
export const newKey = (): string => hex(crypto.getRandomValues(new Uint8Array(16)));
export const isKey = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-f]{32}$/.test(x);

interface Described { currentLocalDescription?: { sdp: string } | null; currentRemoteDescription?: { sdp: string } | null }
/** Every certificate fingerprint a side's description names (a forged second one changes the whole). */
const prints = (d?: { sdp: string } | null): string =>
  [...new Set([...(d?.sdp ?? '').matchAll(/^a=fingerprint:(.*)$/gim)].map((m) => m[1].trim().toLowerCase()))].sort().join(',');
/** This connection's two ends, as WebRTC itself agreed them: what a proof is good for. Empty where there is none (tests). */
export const ends = (pc: Described | undefined): { here: string; there: string } =>
  ({ here: prints(pc?.currentLocalDescription), there: prints(pc?.currentRemoteDescription) });

/** What a proof is for: this room, this one-time number, and the channel between this host and this phone. */
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

// The number a waiting phone and the host screen both show ("482 913"), never sent: each works it
// out from a value of each end's and its own connection's ends. The phone's hello commits to its
// value (a hash), the host then sends its own, and only then does the phone show its value: a guest
// in between, holding one connection to each, has to choose on both before it can know either
// number, so it cannot search for two that match.

const sha256 = async (text: string): Promise<ArrayBuffer | null> => {
  try { return await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); } catch { return null; }
};
/** What a hello carries of the phone's value; empty without crypto.subtle (plain http). */
export async function commitOf(value: string): Promise<string> {
  const sum = await sha256(value);
  return sum ? hex(new Uint8Array(sum)) : '';
}
export const isCommit = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x);

/** The two ends' values and fingerprints. Null without fingerprints or crypto.subtle: no number to compare. */
export async function numberOf(e: { hostValue: string; phoneValue: string; host: string; phone: string }): Promise<string | null> {
  const sum = e.host && e.phone ? await sha256(JSON.stringify(['seat number', e.hostValue, e.phoneValue, e.host, e.phone])) : null;
  if (!sum) return null;
  const n = String(new DataView(sum).getUint32(0) % 1_000_000).padStart(6, '0');
  return `${n.slice(0, 3)} ${n.slice(3)}`;
}

/** What a waiting phone shows: its own words, whatever the host sends. */
export const WAITING = 'Waiting for a Yes on the host screen.';

type Pair = [string, string];
const pairs = (x: unknown, ok: (p: Pair) => boolean): Pair[] =>
  Array.isArray(x) ? x.filter((p): p is Pair => Array.isArray(p) && p.length === 2 && ok(p as Pair)) : [];

// --- the phone's keys ---

const RING_MAX = 200;
const KEYS_EACH = 2;

/**
 * A phone's keys in one game: the two newest of each room (an enrolment cut short, or asked for by
 * a screen that only says it is the host, leaves the one before usable), oldest first. Kept in
 * memory where storage is blocked.
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

  bind(pid: string, key: string): void {
    this.keys.set(pid, key);
    this.save();
  }

  kick(pid: string): void {
    this.keys.delete(pid);
    this.out.add(pid);
    this.save();
  }

  /** The empty room moves to another code: a room of its own from now on, as another tab may hold the old one. */
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

  /** The old record goes first: where a new one will not fit, seats ask the host rather than trust an old key. */
  private save(): void {
    remove(`${this.game}:seats`);
    save(`${this.game}:seats`, { room: this.room, keys: [...this.keys], kicked: [...this.out] });
  }
}

// --- the rules ---

export const REMOVED = 'The host removed you from this room.';
const RELOAD = 'Reload this page to rejoin.';
const IN_USE = 'That seat is in use on another phone.';
const SAID_NO = 'The host said no.';
const NO_ANSWER = 'The host did not answer. Try again.';
const BUSY = 'Another phone is asking for that seat. Try again in a minute.';
const CROWD = 'Too many phones are waiting for the host. Try again in a minute.';
const CHANGED = 'The room changed while you waited. Join again.';

/** How long the host has to answer. */
export const ASK_MS = 60_000;
/** After a phone was sent a value and its question never came, how long until its seat can be asked for again: no fast guessing. */
export const COOL_MS = 5_000;
const ASKS_MAX = 8;

interface Row { pid: string; name: string }
/** The seat a game gives a phone: its player, and whether it is new to the game. `then`: what to do once it is welcomed. */
export interface Seat extends Row { fresh: boolean; then: () => void }

/** The seat a game's join rules gave: whose it is, and whether the game already had that player. */
export const seatIn = (players: readonly Row[], joined: { pid: string; game: { players: readonly Row[] } }): Omit<Seat, 'then'> => ({
  pid: joined.pid,
  name: joined.game.players.find((p) => p.pid === joined.pid)?.name ?? '',
  fresh: !players.some((p) => p.pid === joined.pid),
});

/** `modern`: its page can do keys. `approved`: the host tapped Yes. */
export interface Claim { modern: boolean; proof: 'none' | 'right' | 'wrong'; approved: boolean }
/** `online`: a phone holds it; `live`: and was heard from just now. */
export interface Held { keyed: boolean; fresh: boolean; online: boolean; live: boolean }
/** 'retry': closed without a word, so the phone tries again by itself. */
export type Step = 'admit' | 'enrol' | 'prove' | 'ask' | 'retry' | { refuse: string };

/** What happens next to a phone asking for a seat. */
export function nextStep(c: Claim, s: Held): Step {
  if (!s.keyed) {
    if (s.live) return 'retry';
    if (!c.modern) return c.approved ? 'admit' : 'ask';
    return s.fresh || c.approved ? 'enrol' : 'ask';
  }
  if (!c.modern) return { refuse: RELOAD };
  if (c.proof === 'none') return 'prove';
  if (c.proof === 'right') return 'admit';
  if (s.online) return { refuse: IN_USE };
  return c.approved ? 'enrol' : 'ask';
}

// --- the desk: phones that have said hello and have no seat yet ---

/**
 * A question on the host screen: may the phone showing `code` have that seat? Null: that phone shows
 * no number (an old page, or plain http). Undefined: its phone has yet to show its value, not asked yet.
 */
export interface Ask { id: number; code: string | null | undefined; name: string; fresh: boolean }

export const askText = ({ name, fresh, code }: Ask): string => {
  const which = code ? `the phone showing ${code}` : 'a phone that shows no number';
  return fresh ? `Let ${name} join from ${which}?` : `Move ${name}’s seat to ${which}?`;
};

interface Call<C> extends Claim {
  conn: C;
  pid: string;
  name: string;
  /** The seat it asks for, once the game has said. */
  seat: string;
  /** What it was last sent and may answer now ('check': its proof is being checked). */
  stage: '' | 'prove' | 'check' | 'enrol' | 'reveal';
  /** The random value it was last sent, for its proof or its number. */
  nonce: string;
  /** The hash of the phone's own value for the number; empty when it shows none. */
  commit: string;
  ask: Ask | null;
}

const claimOf = (c: { pid: string; name: string; seat: string; modern: boolean }) => JSON.stringify([c.pid, c.name, c.seat, c.modern]);

export interface DeskHooks<C> {
  resolve(pid: string, name: string): Seat | { error: string };
  /** Whether a phone holds the seat, and whether it was heard from just now. */
  holder(pid: string): { online: boolean; live: boolean };
  /** Not heard from lately: likely asleep or gone. */
  quiet(conn: C): boolean;
  /** The connection's ends (this host's, the phone's). */
  ends(conn: C): { here: string; there: string };
  send(conn: C, msg: object): void;
  /** Says why, and closes. */
  refuse(conn: C, why: string): void;
  /** Closes without a word: the phone tries again by itself. */
  close(conn: C): void;
  admit(conn: C, seat: Seat): void;
  asks(now: Ask[]): void;
}

export class Desk<C> {
  private calls = new Map<C, Call<C>>();
  private asked = 0;
  /** By seat: until when it may not be asked for. */
  private cooling = new Map<string, number>();
  constructor(private book: SeatBook, private hooks: DeskHooks<C>) {}

  hello(conn: C, pid: string, name: string, modern: boolean, commit: unknown): void {
    if (this.calls.has(conn)) return;
    const call: Call<C> = {
      conn, pid, name, modern, commit: isCommit(commit) ? commit : '', proof: 'none', approved: false, seat: '', stage: '', nonce: '', ask: null,
    };
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
    if (this.calls.get(conn) !== call) return; // meanwhile it closed, its seat was left or taken, or the room moved
    call.proof = want !== '' && macs.includes(want) && this.book.key(call.seat) === key ? 'right' : 'wrong';
    this.advance(call);
  }

  key(conn: C, key: unknown): void {
    const call = this.calls.get(conn);
    if (call?.stage === 'enrol' && isKey(key)) this.advance(call, key);
  }

  /** The phone shows the value it committed to, once: its question appears, with the number. */
  async reveal(conn: C, value: unknown): Promise<void> {
    const call = this.calls.get(conn);
    if (call?.stage !== 'reveal') return;
    call.stage = '';
    const { here, there } = this.hooks.ends(conn);
    const right = isKey(value) && (await commitOf(value)) === call.commit;
    const number = right ? await numberOf({ hostValue: call.nonce, phoneValue: value, host: here, phone: there }) : null;
    if (this.calls.get(conn) !== call || !call.ask) return;
    if (!number) return this.hooks.close(conn);
    call.ask.code = number;
    this.show();
  }

  /** The host's answer to a question still on the screen: for that connection only, while it lasts. */
  answer(ask: Ask, yes: boolean): void {
    const call = this.all().find((c) => c.ask === ask);
    if (!call) return;
    call.ask = null;
    this.show();
    if (!yes) return this.refuse(call, SAID_NO);
    call.approved = true;
    this.advance(call);
  }

  /** Waiting for the host: no other clock runs meanwhile. */
  asking(conn: C): boolean {
    const ask = this.calls.get(conn)?.ask;
    return !!ask && ask.code !== undefined;
  }

  /** The connection is gone, or may not go on. */
  drop(conn: C): void {
    const call = this.calls.get(conn);
    this.calls.delete(conn);
    if (!call?.ask) return;
    if (call.ask.code === undefined) this.cooling.set(call.seat, Date.now() + COOL_MS);
    this.show();
  }

  /** The host removed this player: whoever is asking for the seat is out too. */
  kick(pid: string): void {
    for (const c of this.all()) if (c.seat === pid || c.pid === pid) this.refuse(c, REMOVED);
  }

  /** The seat was taken or left: whoever else is asking for it starts over. */
  release(pid: string): void {
    for (const c of this.all()) if (c.seat === pid) this.hooks.close(c.conn);
  }

  clear(): void {
    this.calls.clear();
    this.show();
  }

  private all(): Call<C>[] { return [...this.calls.values()]; }

  /** The next step for a phone, on the room as it is now; `key`: the one it just made for its seat. */
  private advance(call: Call<C>, key?: string): void {
    const seat = this.hooks.resolve(call.pid, call.name);
    if ('error' in seat) return this.refuse(call, seat.error);
    if (call.seat && call.seat !== seat.pid) return this.refuse(call, CHANGED);
    call.seat = seat.pid;
    const step = nextStep(call, { keyed: this.book.key(seat.pid) !== undefined, fresh: seat.fresh, ...this.hooks.holder(seat.pid) });
    if (typeof step === 'object') return this.refuse(call, step.refuse);
    if (step === 'retry') return this.hooks.close(call.conn);
    if (step === 'prove') return this.prove(call);
    if (step === 'admit') return this.admit(call, seat);
    if (!this.reserve(call)) return;
    if (step === 'ask') return this.ask(call, seat);
    if (!key) return this.enrol(call);
    this.book.bind(seat.pid, key);
    this.admit(call, seat);
  }

  private prove(call: Call<C>): void {
    call.stage = 'prove';
    call.nonce = newKey();
    this.hooks.send(call.conn, { t: 'prove', room: this.book.room, nonce: call.nonce });
  }

  /**
   * One phone at a time asks for or enrols a seat. Another is turned away; the same one on a new
   * connection starts over once its earlier connection has gone quiet, and tries again until then.
   */
  private reserve(call: Call<C>): boolean {
    const rival = this.all().find((c) => c !== call && c.seat === call.seat && (c.ask || c.stage === 'enrol'));
    if (!rival) return true;
    if (claimOf(rival) !== claimOf(call)) this.refuse(call, BUSY);
    else if (!this.hooks.quiet(rival.conn)) this.hooks.close(call.conn);
    else {
      this.hooks.close(rival.conn);
      return true;
    }
    return false;
  }

  /** Asks the phone for a new key. */
  private enrol(call: Call<C>): void {
    call.stage = 'enrol';
    this.hooks.send(call.conn, { t: 'enrol', room: this.book.room });
  }

  /** Puts the question to the host: at once, or for a phone that shows a number once it has shown its value. */
  private ask(call: Call<C>, seat: Seat): void {
    call.stage = '';
    if ((this.cooling.get(call.seat) ?? 0) > Date.now()) return this.hooks.close(call.conn);
    if (this.all().filter((c) => c.ask).length >= ASKS_MAX) return this.refuse(call, CROWD);
    const { here, there } = this.hooks.ends(call.conn);
    const numbered = call.modern && !!call.commit && !!here && !!there && !!globalThis.crypto?.subtle;
    const ask: Ask = { id: ++this.asked, code: numbered ? undefined : null, name: seat.name, fresh: seat.fresh };
    call.ask = ask;
    setTimeout(() => this.expire(ask), ASK_MS);
    if (!numbered) {
      this.hooks.send(call.conn, { t: 'wait' });
      return this.show();
    }
    call.stage = 'reveal';
    call.nonce = newKey();
    this.hooks.send(call.conn, { t: 'wait', value: call.nonce });
  }

  private expire(ask: Ask): void {
    const call = this.all().find((c) => c.ask === ask);
    if (call) this.refuse(call, NO_ANSWER);
  }

  private admit(call: Call<C>, seat: Seat): void {
    this.drop(call.conn);
    this.release(seat.pid);
    this.hooks.admit(call.conn, seat);
  }

  private refuse(call: Call<C>, why: string): void {
    this.drop(call.conn);
    this.hooks.refuse(call.conn, why);
  }

  private show(): void {
    this.hooks.asks(this.all().flatMap((c) => (c.ask && c.ask.code !== undefined ? [c.ask] : [])).sort((a, b) => a.id - b.id));
  }
}
