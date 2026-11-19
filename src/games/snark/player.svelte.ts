// A phone's link to the host screen. It keeps trying until it is told to stop: a locked phone,
// a reload, a dropped Wi-Fi or a reloading host screen all end in a quiet reconnect with the
// same player id, so the host recognises the phone and its score is kept.
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { BROKER_TROUBLE, LINK_TIMEOUT, backoff, classify, makePeer } from './net';
import { currentBroker } from './broker';
import { hostPeerId, newPid } from './code';
import type { ToHost, ToPhone } from './protocol';
import type { PlayerView } from './view';
import { loadMe, saveMe, type Me } from './store';

/** idle: not in a room. joining/live/lost: trying, connected, reconnecting. stopped: told to stop (see `stopped`). */
export type Link = 'idle' | 'joining' | 'live' | 'lost' | 'stopped';

const DIAL_TIMEOUT = 10000;
/** Consecutive "no such room" answers (about two minutes of retries) before a phone stops looking. */
const GIVE_UP_AFTER = 15;

class PlayerSession {
  view = $state.raw<PlayerView | null>(null);
  /** When the view arrived (performance-free ms), for counting its timer down. */
  viewAt = $state(0);
  link = $state<Link>('idle');
  /** Why the phone stopped trying (shown as is), or a problem while still trying. */
  stopped = $state('');
  trouble = $state('');
  me = $state.raw<Me | null>(loadMe());

  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private heard = 0;
  private attempts = 0;
  private missing = 0;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  /** Answers and votes not yet confirmed by the host; sent again after a reconnect. */
  private outbox: ToHost[] = [];

  constructor() {
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
    this.view = null;
    this.start();
  }

  /** Back into the room this phone was in (after a reload). */
  rejoin(): void {
    if (this.me?.code && this.link === 'idle') this.start();
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

  /** Stops trying and forgets the room (keeps the id and name for next time). */
  leave(): void {
    this.halt('');
    this.link = 'idle';
    this.view = null;
    if (this.me) this.setMe({ ...this.me, code: '', joined: false });
  }

  private halt(why: string): void {
    this.stopped = why;
    this.link = 'stopped';
    if (this.retry) clearTimeout(this.retry);
    if (this.watchdog) clearInterval(this.watchdog);
    this.retry = null;
    this.watchdog = null;
    const conn = this.conn;
    this.conn = null;
    conn?.close();
    this.peer?.destroy();
    this.peer = null;
  }

  private setMe(m: Me): void {
    this.me = m;
    saveMe(m);
  }

  /** Sends an answer or vote; kept and re-sent if the link is down. */
  send(msg: ToHost): void {
    if (msg.t !== 'pong') this.outbox.push(msg);
    this.write(msg);
  }

  private write(msg: ToHost): void {
    try { if (this.conn?.open) void this.conn.send(msg); } catch { /* the watchdog reconnects */ }
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
    const conn = this.peer.connect(hostPeerId(this.me.code), { reliable: true, serialization: 'json' });
    this.conn = conn;
    const timeout = setTimeout(() => { if (this.conn === conn && !conn.open) this.lose(conn); }, DIAL_TIMEOUT);
    conn.on('open', () => {
      clearTimeout(timeout);
      if (this.conn !== conn || !this.me) return;
      this.heard = Date.now();
      this.write({ t: 'hello', pid: this.me.pid, name: this.me.name });
    });
    conn.on('data', (raw) => { if (this.conn === conn) this.receive(raw as ToPhone); });
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

  private receive(msg: ToPhone): void {
    this.heard = Date.now();
    switch (msg.t) {
      case 'ping': this.write({ t: 'pong' }); break;
      case 'welcome':
        if (this.me) this.setMe({ ...this.me, pid: msg.pid, joined: true });
        this.link = 'live';
        this.trouble = '';
        this.attempts = 0;
        this.missing = 0;
        for (const m of this.outbox) this.write(m);
        break;
      case 'view':
        this.view = msg.v;
        this.viewAt = Date.now();
        this.prune(msg.v);
        break;
      case 'reject':
        this.halt(msg.why);
        if (this.me) this.setMe({ ...this.me, code: '', joined: false });
        break;
      case 'ended':
        this.halt('The host ended the game. Thanks for playing!');
        if (this.me) this.setMe({ ...this.me, code: '', joined: false });
        break;
    }
  }

  /** Drops queued messages the host has clearly received (or that no longer apply). */
  private prune(v: PlayerView): void {
    const s = v.screen;
    this.outbox = this.outbox.filter((m) =>
      m.t === 'answer' ? s.k === 'write' && s.tasks.some((t) => t.i === m.i)
      : m.t === 'vote' ? s.k === 'vote' && s.voted === null
      : m.t === 'votes' ? s.k === 'vote3' && !s.sent
      : false);
  }

  /** Time left on the current timer, counted down locally from what the host last sent. */
  left(now: number): number | null {
    const v = this.view;
    if (!v || v.left === null) return null;
    return v.paused ? v.left : Math.max(0, v.left - (now - this.viewAt));
  }
}

// One per page. In development the instance is kept on window, so a hot module reload (another
// file changing) reuses the live session instead of starting a second one beside it; the
// headless tests read it there too.
const devWindow = (import.meta.env.DEV && typeof window !== 'undefined' ? window : null) as unknown as { snarkPhone?: PlayerSession } | null;
export const phone: PlayerSession = devWindow ? (devWindow.snarkPhone ??= new PlayerSession()) : new PlayerSession();
