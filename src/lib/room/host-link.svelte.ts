// The host screen's side of an own-phones room: one PeerJS peer under the room's id, a link to
// each phone, pings, and the hello/welcome/reject/ended handshake. The game decides who may join
// and what each message means (`HostHooks`), seats.ts whose seat it is; this only moves messages. Big messages travel as
// parts (parts.ts) both ways. A seat run on this screen (a bot, `seat`) joins, is sent and acts
// exactly as a phone would, through the same hooks; only the wire is skipped.
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { BROKER_TROUBLE, LINK_TIMEOUT, PING_MS, backoff, classify, makePeer } from './net';
import { currentBroker } from './broker';
import { hostPeerId, newPid } from './code';
import { Assembler, toWire } from './parts';
import { Desk, REMOVED, SeatBook, ends, type Ask, type Seat } from './seats';

export type HostStatus = 'connecting' | 'open' | 'trouble';

const HELLO_TIMEOUT = 10000;

/** A message as JSON carries it (what a phone would send or get), or null. */
const wire = (msg: unknown): unknown => { try { return JSON.parse(JSON.stringify(msg)); } catch { return null; } };
const str = (x: unknown, max: number): x is string => typeof x === 'string' && x.length <= max;
/** A player id a phone may use: the games keep their records by it, so never a name every object has. */
const goodPid = (pid: string) => /^[\w-]{1,64}$/.test(pid) && !(pid in {});

/** Marks a seat run on this screen in every list of players; a phone's name may not start with it. */
export const BOT_MARK = '🤖';
/** How the id of a seat run on this screen starts; no phone may use such an id. */
export const BOT_PID = 'bot-';
/** A phone's name without the bot mark (and the emoji variation selector that may follow it). */
export const unmarked = (name: string) => name.replace(/^(?:\s|🤖|\uFE0F)+/u, '');
const MARK_ONLY = 'Pick a name without 🤖 (it marks bots).';
const BAD_PID = 'This phone cannot join. Reload the page and try again.';
const BOT_SEAT = 'That name is already in use. Pick another name.';

/** A pretend phone run by this screen: it gets what a phone would get, as it would read it off the link. */
export interface LocalSeat { deliver(msg: { t: string; [k: string]: unknown }): void }

export interface HostHooks {
  /** A phone says hello: the seat it would get, or why it may not join. Asked more than once; only `then` changes the game. */
  hello(pid: string, name: string, online: ReadonlySet<string>): Seat | { error: string };
  /** Any other message from a welcomed phone, as received; the game checks its shape. */
  message(pid: string, raw: unknown): void;
  /** The player tapped "Leave room" on their phone: they stop getting turns. */
  left(pid: string): void;
  /** The room's id is taken on the broker: a new code to try, or null to keep retrying this one. */
  taken(): string | null;
}

export class HostLink {
  status = $state<HostStatus>('connecting');
  trouble = $state('');
  online = $state.raw<ReadonlySet<string>>(new Set());
  /** Questions for the host: may this phone have that seat? */
  asks = $state.raw<Ask[]>([]);

  private code = '';
  private peer: Peer | null = null;
  private links = new Map<string, DataConnection>();
  private pidOf = new Map<DataConnection, string>();
  private heard = new Map<DataConnection, number>();
  private parts = new Map<DataConnection, Assembler>();
  private locals = new Map<string, LocalSeat>();
  private pinger: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  /** The code is taken and the room is leaving it: nobody is let in until the new peer is up. */
  private moving = false;
  private book: SeatBook;
  private desk: Desk<DataConnection>;

  constructor(private game: string, private hooks: HostHooks) {
    this.book = new SeatBook(game);
    this.desk = new Desk(this.book, {
      resolve: (pid, name) => this.resolve(pid, name),
      holder: (pid) => {
        const conn = this.links.get(pid);
        return { online: this.online.has(pid), live: !!conn && !this.quiet(conn) };
      },
      quiet: (conn) => this.quiet(conn),
      ends: (conn) => ends(conn.peerConnection),
      send: (conn, msg) => this.write(conn, msg),
      refuse: (conn, why) => this.refuse(conn, why),
      close: (conn) => this.cut(conn),
      admit: (conn, seat) => this.admit(conn, seat),
      asks: (now) => { this.asks = now; },
    });
  }

  /** The room's id, saved with its game. */
  get room(): string { return this.book.room; }

  /** Registers the room on the broker under its code and starts pinging; `saved`: a saved game's room id (its seats' keys), or empty. */
  open(code: string, saved: string): void {
    this.code = code;
    this.book.open(saved);
    this.connect();
    this.pinger ??= setInterval(() => this.ping(), PING_MS);
  }

  /** Sends a message to one phone, if it is online. */
  send(pid: string, msg: object): void {
    const conn = this.links.get(pid);
    if (conn) this.write(conn, msg);
    else if (this.locals.has(pid)) this.deliver(pid, msg);
  }

  /** The phones online now (seats run on this screen included). */
  pids(): string[] { return [...this.links.keys(), ...this.locals.keys()]; }

  /** Seats a pretend phone run by this screen: it says hello like a phone, under the same rules. */
  seat(pid: string, name: string, seat: LocalSeat): { pid: string } | { error: string } {
    const res = this.hooks.hello(pid, name, this.online);
    if ('error' in res) return res;
    // A seat run here only ever takes its own id, never someone else's (an offline player's by name).
    if (res.pid !== pid) return { error: BOT_SEAT };
    this.locals.set(res.pid, seat);
    this.refresh();
    this.deliver(res.pid, { t: 'welcome', pid: res.pid });
    res.then();
    return { pid: res.pid };
  }

  /** A message from a seat run on this screen, read exactly as one from a phone. */
  act(pid: string, msg: object): void {
    if (!this.locals.has(pid)) return;
    const m = wire(msg) as { t?: unknown } | null;
    if (!m || typeof m !== 'object' || m.t === 'hello' || m.t === 'pong') return;
    if (m.t !== 'leave') return this.hooks.message(pid, m);
    this.locals.delete(pid);
    this.refresh();
    this.hooks.left(pid);
  }

  /** The host's Yes or No to one of `asks`. */
  answer(ask: Ask, yes: boolean): void { this.desk.answer(ask, yes); }

  /** Removes a player for good: tells their phone why, stops listening to it and closes its link. */
  remove(pid: string, why: string): void {
    if (this.locals.has(pid)) {
      this.deliver(pid, { t: 'reject', why });
      this.locals.delete(pid);
      this.refresh();
      return;
    }
    this.book.kick(pid);
    this.desk.kick(pid);
    const conn = this.links.get(pid);
    if (conn) this.refuse(conn, why);
  }

  /** Re-registers the room on the broker now chosen in Connection settings. Phones rejoin through the new QR code. */
  rebroker(): void {
    this.stopPeer();
    this.connect();
  }

  /** Tells every phone the game ended and closes the room. */
  close(): void {
    for (const conn of this.links.values()) this.write(conn, { t: 'ended' });
    for (const pid of this.locals.keys()) this.deliver(pid, { t: 'ended' });
    this.locals.clear();
    const peer = this.peer;
    this.peer = null;
    setTimeout(() => peer?.destroy(), 600);
    this.stopPeer();
    this.book.close();
    if (this.pinger) clearInterval(this.pinger);
    this.pinger = null;
    this.status = 'connecting';
    this.trouble = '';
  }

  private stopPeer(): void {
    const peer = this.peer;
    this.peer = null;
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    this.attempts = 0;
    peer?.destroy();
    this.links.clear();
    this.pidOf.clear();
    this.heard.clear();
    this.parts.clear();
    this.desk.clear();
    this.refresh();
  }

  /** Online: every phone with a link, and every seat run here. */
  private refresh(): void {
    this.online = new Set([...this.links.keys(), ...this.locals.keys()]);
  }

  /** What a seat run here receives: a copy as it would come off the wire, a moment later. */
  private deliver(pid: string, msg: object): void {
    const seat = this.locals.get(pid);
    const copy = wire(msg) as { t: string } | null;
    if (seat && copy) queueMicrotask(() => seat.deliver(copy));
  }

  private connect(): void {
    this.status = 'connecting';
    this.moving = false;
    const peer = makePeer(hostPeerId(this.game, this.code), currentBroker());
    this.peer = peer;
    peer.on('open', () => {
      if (this.peer !== peer) return;
      this.status = 'open';
      this.trouble = '';
      this.attempts = 0;
    });
    peer.on('connection', (conn) => { if (this.peer === peer) this.accept(conn); });
    peer.on('disconnected', () => this.recover(peer));
    peer.on('error', (err) => {
      if (this.peer !== peer) return;
      const kind = classify(err);
      if (kind === 'no-host' || (kind === 'other' && peer.open)) return; // one phone's link failed, not the room
      if (kind === 'broker') { this.status = 'trouble'; this.trouble = BROKER_TROUBLE; }
      // PeerJS reports a taken id before it destroys (or, once registered, disconnects) the peer.
      // A new code means a new peer: make sure this one is gone, so the retry registers that code.
      if (kind === 'taken') {
        const code = this.hooks.taken();
        if (code) {
          this.code = code;
          this.moving = true;
          this.desk.clear();
          setTimeout(() => {
            if (this.peer !== peer) return; // closed, or moved to another peer, meanwhile
            if (!peer.destroyed) peer.destroy();
            this.recover(peer);
          }, 0);
        }
      }
      this.recover(peer);
    });
  }

  /** Lost the broker: reconnect the same peer (phone links survive), or start a new one once it is gone. */
  private recover(peer: Peer): void {
    if (this.peer !== peer || this.retry) return;
    if (!peer.destroyed && !peer.disconnected) return;
    this.retry = setTimeout(() => {
      this.retry = null;
      if (this.peer !== peer) return;
      if (peer.destroyed) this.connect();
      else if (peer.disconnected) {
        try { peer.reconnect(); } catch { peer.destroy(); this.connect(); }
      }
    }, backoff(this.attempts++));
  }

  private accept(conn: DataConnection): void {
    this.heard.set(conn, Date.now());
    this.parts.set(conn, new Assembler());
    conn.on('data', (raw) => this.receive(conn, raw));
    conn.on('close', () => this.drop(conn));
    conn.on('error', () => this.drop(conn));
    this.deadline(conn);
  }

  /** A phone without a seat after a while is closed (it tries again), unless the host is being asked about it. */
  private deadline(conn: DataConnection): void {
    setTimeout(() => {
      if (this.pidOf.has(conn) || !this.heard.has(conn)) return;
      if (this.desk.asking(conn)) this.deadline(conn);
      else this.cut(conn);
    }, HELLO_TIMEOUT);
  }

  private quiet(conn: DataConnection): boolean { return Date.now() - (this.heard.get(conn) ?? 0) > 2 * PING_MS; }

  /** Stops listening to a connection at once and closes it. */
  private cut(conn: DataConnection): void {
    this.drop(conn);
    conn.close();
  }

  private drop(conn: DataConnection): void {
    this.desk.drop(conn);
    const pid = this.pidOf.get(conn);
    this.pidOf.delete(conn);
    this.heard.delete(conn);
    this.parts.delete(conn);
    if (pid && this.links.get(pid) === conn) {
      this.links.delete(pid);
      this.refresh();
    }
  }

  private ping(): void {
    const now = Date.now();
    for (const [conn, at] of this.heard) {
      if (now - at > LINK_TIMEOUT) { conn.close(); this.drop(conn); }
      else this.write(conn, { t: 'ping' });
    }
  }

  private write(conn: DataConnection, msg: object): void {
    try {
      if (conn.open) for (const m of toWire(msg, newPid)) void conn.send(m);
    } catch { /* the link is going; ping notices */ }
  }

  private receive(conn: DataConnection, raw: unknown): void {
    const msg = this.parts.get(conn)?.take(raw) as { t?: unknown; pid?: unknown; name?: unknown; keys?: unknown; macs?: unknown; key?: unknown } | null | undefined;
    if (!msg || typeof msg !== 'object') return;
    this.heard.set(conn, Date.now());
    if (msg.t === 'pong') return;
    const pid = this.pidOf.get(conn);
    if (msg.t === 'hello' || msg.t === 'proof' || msg.t === 'key') {
      if (pid || this.moving) return; // seated already; or moving to a new code, where the phone asks again
      if (msg.t === 'proof') void this.desk.proof(conn, msg.macs);
      else if (msg.t === 'key') this.desk.key(conn, msg.key);
      else if (str(msg.pid, 64) && str(msg.name, 200)) this.hello(conn, msg.pid, msg.name, msg.keys === 1);
      return;
    }
    if (!pid) return;
    if (msg.t === 'leave') {
      this.cut(conn);
      this.desk.release(pid);
      this.hooks.left(pid);
    } else this.hooks.message(pid, msg);
  }

  private hello(conn: DataConnection, pid: string, raw: string, modern: boolean): void {
    const name = unmarked(raw);
    if (!name.trim() && raw.trim()) return this.refuse(conn, MARK_ONLY);
    if (pid.startsWith(BOT_PID)) return this.refuse(conn, BOT_SEAT); // a phone may not take a seat run here
    this.desk.hello(conn, pid, name, modern);
  }

  /** The seat the game gives a phone now, unless it is run here or its player was removed. */
  private resolve(pid: string, name: string): Seat | { error: string } {
    const res = goodPid(pid) ? this.hooks.hello(pid, name, this.online) : { error: BAD_PID };
    if ('error' in res) return res;
    if (!goodPid(res.pid)) return { error: BAD_PID }; // by name, a player saved before ids were checked
    if (this.locals.has(res.pid) || res.pid.startsWith(BOT_PID)) return { error: BOT_SEAT };
    return this.book.kicked(pid) || this.book.kicked(res.pid) ? { error: REMOVED } : res;
  }

  private refuse(conn: DataConnection, why: string): void {
    this.write(conn, { t: 'reject', why });
    this.drop(conn);
    setTimeout(() => conn.close(), 1500);
  }

  /** The seat is this phone's: whatever held it before is cut off. */
  private admit(conn: DataConnection, seat: Seat): void {
    if (!conn.open) return this.drop(conn);
    const old = this.links.get(seat.pid);
    if (old && old !== conn) this.cut(old);
    this.links.set(seat.pid, conn);
    this.pidOf.set(conn, seat.pid);
    this.refresh();
    this.write(conn, { t: 'welcome', pid: seat.pid });
    seat.then();
  }
}
