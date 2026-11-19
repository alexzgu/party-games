// The host screen's room: one PeerJS peer under the room's id, a link to each phone, the game
// state, and the clock that moves the game on. It lives at module level, so the host can open
// settings or a pack and come back without dropping anyone; only "End game" closes it. Every
// change is saved, so a reload reopens the same room and phones reconnect by themselves.
import type Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { BROKER_TROUBLE, LINK_TIMEOUT, PING_MS, backoff, classify, makePeer } from './net';
import { currentBroker } from './broker';
import { hostPeerId, newCode } from './code';
import * as L from './logic';
import { playerView } from './view';
import { readToHost, type ToHost, type ToPhone } from './protocol';
import { loadGame, loadSettings, saveGame, saveSettings } from './store';
import { gameRecord } from './record';
import { dedupe, snarkPacks } from '../../lib/content';
import { makeBag } from '../../lib/bag';
import { record } from '../../lib/history';

export type HostStatus = 'connecting' | 'open' | 'trouble';

const HELLO_TIMEOUT = 10000;

export const packNames = (ids: string[]) => snarkPacks().filter((p) => ids.includes(p.id)).map((p) => p.name);

/** Prompts for a round from the chosen packs, never repeating until the pool runs out (across games too). */
export function drawPrompts(packIds: string[], count: number): string[] {
  const packs = snarkPacks();
  let pool = dedupe(packs.filter((p) => packIds.includes(p.id)).flatMap((p) => p.prompts));
  if (!pool.length) pool = dedupe(packs.find((p) => p.id === 'classic')?.prompts ?? ['Say something funny']);
  const bag = makeBag('snark', pool, (x) => x);
  return Array.from({ length: count }, () => bag.next()!);
}

class HostSession {
  game = $state.raw<L.Game | null>(null);
  online = $state.raw<ReadonlySet<string>>(new Set());
  status = $state<HostStatus>('connecting');
  trouble = $state('');
  now = $state(Date.now());

  private peer: Peer | null = null;
  private links = new Map<string, DataConnection>();
  private pidOf = new Map<DataConnection, string>();
  private heard = new Map<DataConnection, number>();
  private timers: ReturnType<typeof setInterval>[] = [];
  private retry: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;

  get running() { return this.game !== null; }

  /** Reopens the saved room, or opens a new one. Does nothing when already open. */
  open(): void {
    if (this.game) return;
    const saved = loadGame();
    const g = saved ? L.afterReload(saved, Date.now()) : L.newGame(newCode(), loadSettings());
    this.game = g;
    saveGame(g);
    this.connect();
    this.timers = [setInterval(() => this.tick(), 250), setInterval(() => this.ping(), PING_MS)];
  }

  // --- the broker and the phones ---

  private connect(): void {
    const g = this.game;
    if (!g) return;
    this.status = 'connecting';
    const peer = makePeer(hostPeerId(g.code), currentBroker());
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
      // A brand-new room whose code is taken simply takes another code.
      if (kind === 'taken' && this.game && this.game.phase === 'lobby' && L.present(this.game).length === 0 && peer.destroyed) {
        this.commit({ ...this.game, code: newCode() });
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
      if (this.peer !== peer || !this.game) return;
      if (peer.destroyed) this.connect();
      else if (peer.disconnected) {
        try { peer.reconnect(); } catch { peer.destroy(); this.connect(); }
      }
    }, backoff(this.attempts++));
  }

  private accept(conn: DataConnection): void {
    this.heard.set(conn, Date.now());
    conn.on('data', (raw) => this.receive(conn, raw));
    conn.on('close', () => this.drop(conn));
    conn.on('error', () => this.drop(conn));
    setTimeout(() => { if (!this.pidOf.has(conn) && this.heard.has(conn)) { conn.close(); this.drop(conn); } }, HELLO_TIMEOUT);
  }

  private drop(conn: DataConnection): void {
    const pid = this.pidOf.get(conn);
    this.pidOf.delete(conn);
    this.heard.delete(conn);
    if (pid && this.links.get(pid) === conn) {
      this.links.delete(pid);
      this.online = new Set(this.links.keys());
    }
  }

  private ping(): void {
    const now = Date.now();
    for (const [conn, at] of this.heard) {
      if (now - at > LINK_TIMEOUT) { conn.close(); this.drop(conn); }
      else this.send(conn, { t: 'ping' });
    }
  }

  private send(conn: DataConnection, msg: ToPhone): void {
    try { if (conn.open) void conn.send(msg); } catch { /* the link is going; ping notices */ }
  }

  private receive(conn: DataConnection, raw: unknown): void {
    const msg = readToHost(raw);
    const g = this.game;
    if (!msg || !g) return;
    this.heard.set(conn, Date.now());
    if (msg.t === 'pong') return;
    if (msg.t === 'hello') return this.hello(conn, msg.pid, msg.name);
    const pid = this.pidOf.get(conn);
    if (!pid) return;
    const next = this.apply(g, pid, msg);
    if (next === g) this.sendView(pid); // refused: put the phone back in step
    this.commit(next);
    this.tick();
  }

  private apply(g: L.Game, pid: string, msg: ToHost): L.Game {
    switch (msg.t) {
      case 'answer': return L.answer(g, pid, msg.i, msg.text);
      case 'vote': return L.vote(g, pid, msg.c);
      case 'votes': return L.voteFinal(g, pid, msg.v);
      default: return g;
    }
  }

  private hello(conn: DataConnection, pid: string, name: string): void {
    const res = L.join(this.game!, pid, name, this.online);
    if (res.error !== undefined) {
      this.send(conn, { t: 'reject', why: res.error });
      setTimeout(() => conn.close(), 1500);
      return;
    }
    const old = this.links.get(res.pid);
    if (old && old !== conn) { this.pidOf.delete(old); this.heard.delete(old); old.close(); }
    this.links.set(res.pid, conn);
    this.pidOf.set(conn, res.pid);
    this.online = new Set(this.links.keys());
    this.send(conn, { t: 'welcome', pid: res.pid });
    if (res.game === this.game) this.sendView(res.pid);
    else this.commit(res.game);
  }

  private sendView(pid: string): void {
    const conn = this.links.get(pid);
    const v = this.game && playerView(this.game, pid, Date.now());
    if (conn && v) this.send(conn, { t: 'view', v });
  }

  // --- the game ---

  /** Saves and sends every change; records History the moment a game ends. */
  private commit(next: L.Game): void {
    if (next === this.game) return;
    if (next.phase === 'over' && !next.recorded) {
      const entry = gameRecord(next, packNames(next.settings.packIds));
      if (entry) record(entry);
      next = { ...next, recorded: true };
    }
    this.game = next;
    saveGame(next);
    for (const pid of this.links.keys()) this.sendView(pid);
  }

  private draw = (n: number) => drawPrompts(this.game?.settings.packIds ?? [], n);

  private tick(): void {
    this.now = Date.now();
    if (this.game) this.commit(L.tick(this.game, this.now, this.online, this.draw));
  }

  start(): void {
    if (this.game && L.canStart(this.game)) this.commit(L.startRound(this.game, this.draw, Date.now()));
  }

  skip(): void {
    if (this.game) this.commit(L.step(this.game, Date.now(), this.draw));
  }

  pause(): void { if (this.game) this.commit(L.pause(this.game, Date.now())); }
  resume(): void { if (this.game) this.commit(L.resume(this.game, Date.now())); }

  kick(pid: string): void {
    if (!this.game) return;
    this.commit(L.kick(this.game, pid));
    const conn = this.links.get(pid);
    if (conn) {
      this.send(conn, { t: 'reject', why: 'The host removed you from this game.' });
      setTimeout(() => conn.close(), 1500);
    }
  }

  settings(s: L.Settings): void {
    saveSettings(s);
    if (this.game?.phase === 'lobby') this.commit({ ...this.game, settings: s });
  }

  rematch(): void { if (this.game) this.commit(L.rematch(this.game)); }

  /** Re-registers the room on the broker now chosen in Connection settings. Phones rejoin through the new QR code. */
  rebroker(): void {
    if (!this.game) return;
    const peer = this.peer;
    this.peer = null;
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    this.attempts = 0;
    peer?.destroy();
    this.links.clear();
    this.pidOf.clear();
    this.heard.clear();
    this.online = new Set();
    this.connect();
  }

  /** Closes the room. A game stopped before its winner goes in History as ended early, if anything was scored. */
  end(): void {
    const g = this.game;
    if (!g) return;
    if (!g.recorded) {
      const entry = gameRecord(L.endEarly(g), packNames(g.settings.packIds));
      if (entry) record(entry);
    }
    for (const conn of this.links.values()) this.send(conn, { t: 'ended' });
    const peer = this.peer;
    setTimeout(() => peer?.destroy(), 600);
    this.timers.forEach(clearInterval);
    if (this.retry) clearTimeout(this.retry);
    this.timers = [];
    this.retry = null;
    this.peer = null;
    this.links.clear();
    this.pidOf.clear();
    this.heard.clear();
    this.online = new Set();
    this.game = null;
    this.status = 'connecting';
    this.trouble = '';
    saveGame(null);
  }
}

// One per page. In development the instance is kept on window, so a hot module reload (another
// file changing) reuses the live session instead of starting a second one beside it; the
// headless tests read it there too.
const devWindow = (import.meta.env.DEV && typeof window !== 'undefined' ? window : null) as unknown as { snarkHost?: HostSession } | null;
export const host: HostSession = devWindow ? (devWindow.snarkHost ??= new HostSession()) : new HostSession();
