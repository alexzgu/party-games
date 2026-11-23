// A phone's link to the host screen of an own-phones room. It keeps trying until it is told to
// stop: a locked phone, a reload, a dropped Wi-Fi or a reloading host screen all end in a quiet
// reconnect with the same player id and proof of its seat's key (seats.ts), so the host
// recognises the phone and its score is kept.
// The game supplies what its views look like and which queued messages a view makes stale.
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { BROKER_TROUBLE, LINK_TIMEOUT, backoff, classify, makePeer } from './net';
import { currentBroker } from './broker';
import { hostPeerId, newPid } from './code';
import { Assembler, toWire } from './parts';
import { KeyRing, ends, isKey, proofOf } from './seats';
import { load, remove, save } from '../storage';

/** idle: not in a room. joining/live/lost: trying, connected, reconnecting. stopped: told to stop (see `stopped`). */
export type Link = 'idle' | 'joining' | 'live' | 'lost' | 'stopped';

/** A phone's player: its id, the name it joined with and the room it is in. */
export interface Me { pid: string; name: string; code: string; /** The host has welcomed this phone into that room. */ joined?: boolean }

/** Every view carries the time left on its timer (ms, or null) and whether the game is paused. */
export interface BaseView { left: number | null; paused: boolean }

export interface PhoneHooks<Out, V> {
  /** Whether a queued message still needs (re)sending, given the host's newest view. */
  keep(msg: Out, view: V): boolean;
  /** A message from the host that is not part of the handshake (e.g. a drawing). */
  other?(msg: { t: string }): void;
}

const DIAL_TIMEOUT = 10000;
/** Consecutive "no such room" answers (about two minutes of retries) before a phone stops looking. */
const GIVE_UP_AFTER = 15;
/** How long a leaving phone keeps its link open, so its goodbye reaches the host. */
const LEAVE_GRACE = 400;

export function loadMe(game: string): Me | null {
  const m = load<Partial<Me> | null>(`${game}:me`, null);
  return m && typeof m.pid === 'string' && typeof m.name === 'string' && typeof m.code === 'string' ? (m as Me) : null;
}

export class PhoneLink<Out extends { t: string }, V extends BaseView> {
  view = $state.raw<V | null>(null);
  /** When the view arrived (ms), for counting its timer down. */
  viewAt = $state(0);
  link = $state<Link>('idle');
  /** Why the phone stopped trying (shown as is), or a problem while still trying. */
  stopped = $state('');
  trouble = $state('');
  me = $state.raw<Me | null>(null);
  /** The room the phone is in or last tried; kept after a refusal or the end, so the reason stays with that room's code. */
  room = $state('');

  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private parts = new Assembler();
  private heard = 0;
  private attempts = 0;
  private missing = 0;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  /** Messages not yet confirmed by the host; sent again after a reconnect. */
  private outbox: Out[] = [];
  /** Reconnected: re-send the outbox once the host's fresh view has pruned it. */
  private replay = false;
  private keys: KeyRing;

  constructor(private game: string, private hooks: PhoneHooks<Out, V>) {
    this.keys = new KeyRing(game);
    this.me = loadMe(game);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && (this.link === 'lost' || this.link === 'joining')) this.now();
      });
    }
  }

  /** Joins a room by code and name (a new attempt: an unknown code is reported, not retried). */
  join(code: string, name: string): void {
    const pid = this.me?.pid ?? newPid();
    this.halt(''); // a fresh peer, on the broker chosen now
    this.setMe({ pid, name, code, joined: false });
    this.room = code;
    this.view = null;
    this.start();
  }

  /** Back into the room this phone was in (after a reload). */
  rejoin(): void {
    if (this.me?.code && this.link === 'idle') {
      this.room = this.me.code;
      this.start();
    }
  }

  /** Tells the host this player left (so they stop getting turns), stops trying and forgets the room (keeps the id and name for next time). */
  leave(): void {
    if (this.conn?.open) this.write({ t: 'leave' });
    this.halt('', LEAVE_GRACE);
    this.link = 'idle';
    this.view = null;
    this.room = '';
    if (this.me) this.setMe({ ...this.me, code: '', joined: false });
  }

  /** Sends a game message; kept and re-sent after a reconnect until a view shows it arrived. */
  send(msg: Out): void {
    this.outbox.push(msg);
    this.write(msg);
  }

  /** Sends a message that need not survive a dropped link (e.g. asking for a drawing). */
  ask(msg: Out): void { this.write(msg); }

  /** Time left on the current timer, counted down locally from what the host last sent. */
  left(now: number): number | null {
    const v = this.view;
    if (!v || v.left === null) return null;
    return v.paused ? v.left : Math.max(0, v.left - (now - this.viewAt));
  }

  private start(): void {
    this.stopped = '';
    this.trouble = '';
    this.attempts = 0;
    this.missing = 0;
    this.outbox = [];
    this.link = 'joining';
    this.watchdog ??= setInterval(() => this.check(), 2000);
    this.connect();
  }

  /** Stops trying; the old link and peer close now, or after `grace` ms so a last message gets out. */
  private halt(why: string, grace = 0): void {
    this.stopped = why;
    this.link = 'stopped';
    if (this.retry) clearTimeout(this.retry);
    if (this.watchdog) clearInterval(this.watchdog);
    this.retry = null;
    this.watchdog = null;
    const conn = this.conn;
    const peer = this.peer;
    this.conn = null;
    this.peer = null;
    const shut = () => { conn?.close(); peer?.destroy(); };
    if (grace && conn) setTimeout(shut, grace);
    else shut();
  }

  private setMe(m: Me): void {
    this.me = m;
    save(`${this.game}:me`, m);
  }

  private forget(): void {
    if (this.me) this.setMe({ ...this.me, code: '', joined: false });
    else remove(`${this.game}:me`);
  }

  private write(msg: object): void {
    try {
      if (this.conn?.open) for (const m of toWire(msg, newPid)) void this.conn.send(m);
    } catch { /* the watchdog reconnects */ }
  }

  // --- connecting ---

  private connect(): void {
    if (!this.me?.code) return;
    if (this.peer && !this.peer.destroyed) {
      if (this.peer.open) this.dial();
      else if (this.peer.disconnected) { try { this.peer.reconnect(); } catch { this.fresh(); } }
      return;
    }
    this.fresh();
  }

  private fresh(): void {
    this.peer?.destroy();
    const peer = makePeer(null, currentBroker());
    this.peer = peer;
    peer.on('open', () => {
      if (this.peer !== peer) return;
      this.trouble = '';
      this.dial();
    });
    peer.on('disconnected', () => { if (this.peer === peer && this.link !== 'live') this.later(); });
    peer.on('error', (err) => {
      if (this.peer !== peer) return;
      const kind = classify(err);
      if (kind === 'no-host' && !this.me?.joined) {
        this.halt(`No game with code ${this.me?.code}. Check the code on the host screen.`);
        return;
      }
      if (kind === 'broker') this.trouble = BROKER_TROUBLE;
      else if (kind === 'no-host') {
        // The host screen is gone for good (closed while this phone was away): stop, but keep
        // the room so the start screen can still offer to rejoin.
        if (++this.missing >= GIVE_UP_AFTER) {
          this.halt("Can't find the host screen any more. The game may have ended.");
          return;
        }
        this.trouble = 'Waiting for the host screen…';
      }
      this.later();
    });
  }

  private dial(): void {
    if (!this.peer || !this.me) return;
    const old = this.conn;
    this.conn = null;
    old?.close();
    const conn = this.peer.connect(hostPeerId(this.game, this.me.code), { reliable: true, serialization: 'json' });
    this.conn = conn;
    this.parts = new Assembler();
    const timeout = setTimeout(() => { if (this.conn === conn && !conn.open) this.lose(conn); }, DIAL_TIMEOUT);
    conn.on('open', () => {
      clearTimeout(timeout);
      if (this.conn !== conn || !this.me) return;
      this.heard = Date.now();
      this.trouble = '';
      this.write({ t: 'hello', pid: this.me.pid, name: this.me.name, keys: 1 });
    });
    conn.on('data', (raw) => {
      if (this.conn !== conn) return;
      const msg = this.parts.take(raw);
      if (msg && typeof msg === 'object' && typeof (msg as { t?: unknown }).t === 'string') this.receive(msg as { t: string });
    });
    conn.on('close', () => this.lose(conn));
    conn.on('error', () => this.lose(conn));
  }

  private lose(conn: DataConnection): void {
    if (this.conn !== conn) return;
    this.conn = null;
    conn.close();
    this.later();
  }

  /** Tries again after a growing pause (1, 2, 4, then every 8 s). */
  private later(): void {
    if (this.link === 'stopped' || this.link === 'idle' || this.retry) return;
    if (this.link === 'live') this.link = 'lost';
    this.retry = setTimeout(() => { this.retry = null; this.connect(); }, backoff(this.attempts++));
  }

  /** Right now, e.g. when the phone is unlocked. */
  private now(): void {
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    this.attempts = 0;
    this.connect();
  }

  /** A link that went quiet (phone slept, Wi-Fi changed) is dropped and redialled. */
  private check(): void {
    if (this.link === 'live' && this.conn && Date.now() - this.heard > LINK_TIMEOUT) this.lose(this.conn);
  }

  /** Shows the host that this phone has its seat's key, without sending the key. */
  private async prove(room: unknown, nonce: unknown): Promise<void> {
    const conn = this.conn;
    if (!isKey(room) || !isKey(nonce)) return;
    const { here, there } = ends(conn?.peerConnection);
    const mac = await proofOf(this.keys.get(room), { room, nonce, host: there, phone: here });
    if (conn && this.conn === conn) this.write({ t: 'proof', mac });
  }

  private receive(msg: { t: string; pid?: string; v?: V; why?: string; room?: unknown; nonce?: unknown }): void {
    this.heard = Date.now();
    switch (msg.t) {
      case 'ping': this.write({ t: 'pong' }); break;
      case 'prove': void this.prove(msg.room, msg.nonce); break;
      case 'enrol': if (isKey(msg.room)) this.write({ t: 'key', key: this.keys.make(msg.room) }); break;
      case 'wait': this.trouble = msg.why ?? ''; break;
      case 'welcome':
        if (this.me && typeof msg.pid === 'string') this.setMe({ ...this.me, pid: msg.pid, joined: true });
        this.link = 'live';
        this.trouble = '';
        this.attempts = 0;
        this.missing = 0;
        this.replay = true; // the host sends a view right after: replay what still applies then
        break;
      case 'view': {
        const v = msg.v as V;
        this.view = v;
        this.viewAt = Date.now();
        this.outbox = this.outbox.filter((m) => this.hooks.keep(m, v));
        if (this.replay) {
          this.replay = false;
          for (const m of this.outbox) this.write(m);
        }
        break;
      }
      case 'reject':
        this.halt(msg.why ?? '');
        this.forget();
        break;
      case 'ended':
        this.halt('The host ended the game. Thanks for playing!');
        this.forget();
        break;
      default: this.hooks.other?.(msg);
    }
  }
}
