// The host screen's side of an own-phones room: one PeerJS peer under the room's id, a link to
// each phone, pings, and the hello/welcome/reject/ended handshake. The game decides who may join
// and what each message means (`HostHooks`); this only moves messages. Big messages travel as
// parts (parts.ts) both ways.
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { BROKER_TROUBLE, LINK_TIMEOUT, PING_MS, backoff, classify, makePeer } from './net';
import { currentBroker } from './broker';
import { hostPeerId, newPid } from './code';
import { Assembler, toWire } from './parts';

export type HostStatus = 'connecting' | 'open' | 'trouble';

const HELLO_TIMEOUT = 10000;

const str = (x: unknown, max: number): x is string => typeof x === 'string' && x.length <= max;

export interface HostHooks {
  /** A phone said hello: its seat (and what to do once it is welcomed), or why it may not join. */
  hello(pid: string, name: string, online: ReadonlySet<string>): { pid: string; then: () => void } | { error: string };
  /** Any other message from a welcomed phone, as received; the game checks its shape. */
  message(pid: string, raw: unknown): void;
  /** The room's id is taken on the broker: a new code to try, or null to keep retrying this one. */
  taken(): string | null;
}

export class HostLink {
  status = $state<HostStatus>('connecting');
  trouble = $state('');
  online = $state.raw<ReadonlySet<string>>(new Set());

  private code = '';
  private peer: Peer | null = null;
  private links = new Map<string, DataConnection>();
  private pidOf = new Map<DataConnection, string>();
  private heard = new Map<DataConnection, number>();
  private parts = new Map<DataConnection, Assembler>();
  private pinger: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;

  constructor(private game: string, private hooks: HostHooks) {}

  /** Registers the room on the broker under its code and starts pinging. */
  open(code: string): void {
    this.code = code;
    this.connect();
    this.pinger ??= setInterval(() => this.ping(), PING_MS);
  }

  /** Sends a message to one phone, if it is online. */
  send(pid: string, msg: object): void {
    const conn = this.links.get(pid);
    if (conn) this.write(conn, msg);
  }

  /** The phones online now. */
  pids(): string[] { return [...this.links.keys()]; }

  /** Tells a phone why it is out and closes its link. */
  remove(pid: string, why: string): void {
    const conn = this.links.get(pid);
    if (!conn) return;
    this.write(conn, { t: 'reject', why });
    setTimeout(() => conn.close(), 1500);
  }

  /** Re-registers the room on the broker now chosen in Connection settings. Phones rejoin through the new QR code. */
  rebroker(): void {
    this.stopPeer();
    this.connect();
  }

  /** Tells every phone the game ended and closes the room. */
  close(): void {
    for (const conn of this.links.values()) this.write(conn, { t: 'ended' });
    const peer = this.peer;
    this.peer = null;
    setTimeout(() => peer?.destroy(), 600);
    this.stopPeer();
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
    this.online = new Set();
  }

  private connect(): void {
    this.status = 'connecting';
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
      if (kind === 'taken' && peer.destroyed) {
        const code = this.hooks.taken();
        if (code) this.code = code;
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
    setTimeout(() => { if (!this.pidOf.has(conn) && this.heard.has(conn)) { conn.close(); this.drop(conn); } }, HELLO_TIMEOUT);
  }

  private drop(conn: DataConnection): void {
    const pid = this.pidOf.get(conn);
    this.pidOf.delete(conn);
    this.heard.delete(conn);
    this.parts.delete(conn);
    if (pid && this.links.get(pid) === conn) {
      this.links.delete(pid);
      this.online = new Set(this.links.keys());
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
    const msg = this.parts.get(conn)?.take(raw) as { t?: unknown; pid?: unknown; name?: unknown } | null | undefined;
    if (!msg || typeof msg !== 'object') return;
    this.heard.set(conn, Date.now());
    if (msg.t === 'pong') return;
    if (msg.t === 'hello') {
      if (str(msg.pid, 64) && str(msg.name, 200)) this.hello(conn, msg.pid, msg.name);
      return;
    }
    const pid = this.pidOf.get(conn);
    if (pid) this.hooks.message(pid, msg);
  }

  private hello(conn: DataConnection, pid: string, name: string): void {
    const res = this.hooks.hello(pid, name, this.online);
    if ('error' in res) {
      this.write(conn, { t: 'reject', why: res.error });
      setTimeout(() => conn.close(), 1500);
      return;
    }
    const old = this.links.get(res.pid);
    if (old && old !== conn) { this.pidOf.delete(old); this.heard.delete(old); this.parts.delete(old); old.close(); }
    this.links.set(res.pid, conn);
    this.pidOf.set(conn, res.pid);
    this.online = new Set(this.links.keys());
    this.write(conn, { t: 'welcome', pid: res.pid });
    res.then();
  }
}
