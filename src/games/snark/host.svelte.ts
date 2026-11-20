// The host screen's room: one PeerJS peer under the room's id, a link to each phone, the game
// state, and the clock that moves the game on. It lives at module level, so the host can open
// settings or a pack and come back without dropping anyone; only "End game" closes it. Every
// change is saved, so a reload reopens the same room and phones reconnect by themselves.
import { HostLink } from '../../lib/room/host-link.svelte';
import { newCode } from '../../lib/room/code';
import * as L from './logic';
import { playerView } from './view';
import { readToHost } from './protocol';
import { loadGame, loadSettings, saveGame, saveSettings } from './store';
import { gameRecord } from './record';
import { dedupe, snarkPacks, type SnarkPack } from '../../lib/content';
import { makeBag } from '../../lib/bag';
import { record } from '../../lib/history';

export const packNames = (ids: string[]) => snarkPacks().filter((p) => ids.includes(p.id)).map((p) => p.name);

/** The chosen packs, or Classic when none of them has what `has` asks for. */
function source(packIds: string[], has: (p: SnarkPack) => boolean): SnarkPack[] {
  const packs = snarkPacks();
  const chosen = packs.filter((p) => packIds.includes(p.id) && has(p));
  return chosen.length ? chosen : packs.filter((p) => p.id === 'classic' && has(p));
}

/**
 * Prompts for a round from the chosen packs, never repeating until the pool runs out (across
 * games too), each with its pack's stock answer when it has one.
 */
export function drawPrompts(packIds: string[], count: number): L.Dealt[] {
  const packs = source(packIds, (p) => p.prompts.length > 0);
  const pool = packs.length ? dedupe(packs.flatMap((p) => p.prompts)) : ['Say something funny'];
  const safety = new Map(packs.flatMap((p) => Object.entries(p.safety ?? {})));
  const bag = makeBag('snark', pool, (x) => x);
  return Array.from({ length: count }, () => {
    const prompt = bag.next()!;
    const stock = safety.get(prompt);
    return stock ? { prompt, safety: stock } : prompt;
  });
}

/** Finals for three-line duels from the chosen packs (else Classic), never repeating like prompts; none when no pack has any. */
export function drawFinals(packIds: string[], count: number): L.Dealt[] {
  const finals = source(packIds, (p) => !!p.finals?.length).flatMap((p) => p.finals ?? []);
  const seen = new Set<string>();
  const pool = finals.filter((f) => !seen.has(f.prompt) && seen.add(f.prompt));
  const bag = makeBag('snark:finals', pool, (f) => f.prompt);
  return pool.length ? Array.from({ length: count }, () => bag.next()!) : [];
}

class HostSession {
  game = $state.raw<L.Game | null>(null);
  now = $state(Date.now());

  private link = new HostLink('snark', {
    hello: (pid, name, online) => {
      const res = L.join(this.game!, pid, name, online);
      if (res.error !== undefined) return { error: res.error };
      return { pid: res.pid, then: () => { if (res.game === this.game) this.sendView(res.pid); else this.commit(res.game); } };
    },
    message: (pid, raw) => this.receive(pid, raw),
    // A brand-new room whose code is taken simply takes another code.
    taken: () => {
      const g = this.game;
      if (!g || g.phase !== 'lobby' || L.present(g).length) return null;
      this.commit({ ...g, code: newCode() });
      return this.game!.code;
    },
  });
  private ticker: ReturnType<typeof setInterval> | null = null;

  get running() { return this.game !== null; }
  get status() { return this.link.status; }
  get trouble() { return this.link.trouble; }
  get online() { return this.link.online; }

  /** Reopens the saved room, or opens a new one. Does nothing when already open. */
  open(): void {
    if (this.game) return;
    const saved = loadGame();
    const g = saved ? L.afterReload(saved, Date.now()) : L.newGame(newCode(), loadSettings());
    this.game = g;
    saveGame(g);
    this.link.open(g.code);
    this.ticker = setInterval(() => this.tick(), 250);
  }

  private receive(pid: string, raw: unknown): void {
    const msg = readToHost(raw);
    const g = this.game;
    if (!msg || !g) return;
    const next = L.fromPhone(g, pid, msg);
    if (next === g) this.sendView(pid); // refused: put the phone back in step
    this.commit(next);
    this.tick();
  }

  private sendView(pid: string): void {
    const v = this.game && playerView(this.game, pid, Date.now());
    if (v) this.link.send(pid, { t: 'view', v });
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
    for (const pid of this.link.pids()) this.sendView(pid);
  }

  private draw: L.Draw = (n, kind) => (kind === 'lines' ? drawFinals : drawPrompts)(this.game?.settings.packIds ?? [], n);

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
    this.link.remove(pid, 'The host removed you from this game.');
  }

  settings(s: L.Settings): void {
    saveSettings(s);
    if (this.game?.phase === 'lobby') this.commit({ ...this.game, settings: s });
  }

  rematch(): void { if (this.game) this.commit(L.rematch(this.game)); }

  /** Re-registers the room on the broker now chosen in Connection settings. Phones rejoin through the new QR code. */
  rebroker(): void {
    if (this.game) this.link.rebroker();
  }

  /** Closes the room. A game stopped before its winner goes in History as ended early, if anything was scored. */
  end(): void {
    const g = this.game;
    if (!g) return;
    if (!g.recorded) {
      const entry = gameRecord(L.endEarly(g), packNames(g.settings.packIds));
      if (entry) record(entry);
    }
    this.link.close();
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    this.game = null;
    saveGame(null);
  }
}

// One per page. In development the instance is kept on window, so a hot module reload (another
// file changing) reuses the live session instead of starting a second one beside it; the
// headless tests read it there too.
const devWindow = (import.meta.env.DEV && typeof window !== 'undefined' ? window : null) as unknown as { snarkHost?: HostSession } | null;
export const host: HostSession = devWindow ? (devWindow.snarkHost ??= new HostSession()) : new HostSession();
