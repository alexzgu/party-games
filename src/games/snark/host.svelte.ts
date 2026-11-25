// The host screen's room: one PeerJS peer under the room's id, a link to each phone, the game
// state, and the clock that moves the game on. It lives at module level, so the host can open
// settings or a pack and come back without dropping anyone; only "End game" closes it. Every
// change is saved, so a reload reopens the same room and phones reconnect by themselves.
import { HostLink } from '../../lib/room/host-link.svelte';
import { newCode } from '../../lib/room/code';
import { seatIn } from '../../lib/room/seats';
import * as L from './logic';
import { playerView } from './view';
import { readToHost } from './protocol';
import { loadRoom, loadSettings, saveGame, saveSettings } from './store';
import { gameRecord } from './record';
import { snarkPacks } from '../../lib/content';
import { consent, stillAsked } from '../../lib/lend';
import { dealIn, finalsIn, lending, pools, poolNames, promptsOf, roomPrompts, type RoomPrompts } from './room';
import { promptKey } from './pack';
import { makeBag } from '../../lib/bag';
import { record } from '../../lib/history';
import { Bots, isBot } from '../../lib/room/bots';
import { snarkBrain } from './bot';

/** The room's prompts and finals for `players` players: the picks', and the packs that would lend when they are too few (room.ts). */
export const content = (s: L.Settings, players: number): RoomPrompts => roomPrompts(snarkPacks(), s, players);

/**
 * Prompts for a round: the picks' first, then the lenders', none this game already dealt while
 * any is left, each with its pack's stock answer when it has one. Each pool keeps its own bag,
 * so prompts never repeat across games either until the pool runs out.
 */
export function drawPrompts(from: ReturnType<typeof pools>, count: number, used: Set<string>): L.Dealt[] {
  const picks = promptsOf(from.picks), mine = new Set(picks.map(promptKey));
  const lent = promptsOf(from.prompts).filter((q) => !mine.has(promptKey(q)));
  const safety = new Map(from.prompts.flatMap((p) => Object.entries(p.safety ?? {})));
  const keys = ['snark', 'snark:lent'];
  return dealIn([picks, lent], count, (q) => q, used, (i) => makeBag(keys[i], i ? lent : picks, (x) => x)).map((prompt) => {
    const stock = safety.get(prompt);
    return stock ? { prompt, safety: stock } : prompt;
  });
}

/** Finals for three-line duels, dealt like prompts: the picks', then the lenders'; none when neither has any. */
export function drawFinals(from: ReturnType<typeof pools>, count: number, used: Set<string>): L.Dealt[] {
  const picks = finalsIn(from.picks), mine = new Set(picks.map((f) => f.prompt));
  const lent = finalsIn(from.finals).filter((f) => !mine.has(f.prompt));
  const keys = ['snark:finals', 'snark:finals:lent'];
  return dealIn([picks, lent], count, (f) => f.prompt, used, (i) => makeBag(keys[i], i ? lent : picks, (f) => f.prompt));
}

/** The packs a game dealt from, for History: the picks', then the lenders'. */
const names = (g: L.Game) => poolNames(snarkPacks(), g.settings.packIds, g.lent);

class HostSession {
  game = $state.raw<L.Game | null>(null);
  now = $state(Date.now());
  /** The question about lending packs the host said yes to in this room (its key), or ''. */
  agreed = $state('');
  /** The question about lending packs put to the host after Start (its key) while it still stands, or ''. */
  asked = $state('');

  readonly link = new HostLink('snark', {
    hello: (pid, name, online) => {
      const res = L.join(this.game!, pid, name, online);
      if (res.error !== undefined) return { error: res.error };
      return { ...seatIn(this.game!.players, res), then: () => { if (res.game === this.game) this.sendView(res.pid); else this.commit(res.game); } };
    },
    message: (pid, raw) => this.receive(pid, raw),
    known: (pid) => !!this.game?.players.some((p) => p.pid === pid),
    left: (pid) => {
      if (!this.game) return;
      this.commit(L.leave(this.game, pid));
      this.tick();
    },
    // A brand-new room whose code is taken simply takes another code.
    vacant: () => this.game?.phase === 'lobby' && L.present(this.game).every((p) => isBot(p.pid)),
    move: (code) => this.commit({ ...this.game!, code }),
  });
  /** Bots among the game's players; one that cannot be seated again leaves the game. */
  private bots = new Bots(this.link, snarkBrain, () => this.game?.players.map((p) => ({ pid: p.pid, name: p.name, out: p.kicked })) ?? [],
    (pid) => this.kick(pid));
  private ticker: ReturnType<typeof setInterval> | null = null;

  get running() { return this.game !== null; }
  get status() { return this.link.status; }
  get trouble() { return this.link.trouble; }
  get online() { return this.link.online; }

  /** Reopens the saved room, or opens a new one; only in the tab that owns the game's saved room (owner.ts). Does nothing when already open. */
  async open(): Promise<void> {
    if (this.game || !(await this.link.own()) || this.game) return;
    const { game: saved, room } = loadRoom();
    const g = saved ? L.afterReload(saved, Date.now()) : L.newGame(newCode(), loadSettings());
    this.game = g;
    this.agreed = '';
    this.asked = '';
    this.link.open(g.code, room);
    saveGame(g, this.link.room);
    this.bots.open();
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
      const entry = gameRecord(next, names(next));
      if (entry) record(entry);
      next = { ...next, recorded: true };
    }
    this.game = next;
    this.asked = stillAsked(this.asked, next.phase === 'lobby' ? content(next.settings, L.present(next).length).ask : null);
    saveGame(next, this.link.room);
    for (const pid of this.link.pids()) this.sendView(pid);
  }

  /** Deals for `g` from its picks and the packs lent to it (each kind on its own), read when a round starts. */
  private draw = (g: L.Game): L.Draw => (n, kind) => {
    const from = pools(snarkPacks(), g.settings.packIds, g.lent), used = new Set(g.dealt ?? []);
    return kind === 'lines' ? drawFinals(from, n, used) : drawPrompts(from, n, used);
  };

  private tick(): void {
    this.now = Date.now();
    if (this.game) this.commit(L.tick(this.game, this.now, this.online, this.draw(this.game)));
  }

  /**
   * Starts the game, unless other packs would lend and the host has not said yes to that question
   * (`yes` is its key, from the popup): then nothing starts and the question is put to the host.
   */
  start(yes = ''): void {
    const g = this.game;
    const c = g && content(g.settings, L.present(g).length);
    if (!g || !c || !L.canStart(g) || c.problem) return;
    const agreed = consent(c.ask, this.agreed, yes);
    if (agreed === null) {
      this.asked = c.ask!.key;
      return;
    }
    this.agreed = agreed;
    const next = { ...g, lent: lending(c, !!c.ask) };
    this.commit(L.startRound(next, this.draw(next), Date.now()));
  }

  /** The host closed the question without an answer. */
  dismiss(): void { this.asked = ''; }

  skip(): void {
    if (this.game) this.commit(L.step(this.game, Date.now(), this.draw(this.game)));
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

  /** Seats a bot (a pretend phone this screen plays); why not, when the room refuses it. */
  addBot(): string | null { return this.game ? this.bots.add() : null; }

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
      const entry = gameRecord(L.endEarly(g), names(g));
      if (entry) record(entry);
    }
    this.link.close();
    this.bots.close();
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    this.game = null;
    this.agreed = '';
    this.asked = '';
    saveGame(null, '');
  }
}

// One per page. In development the instance is kept on window, so a hot module reload (another
// file changing) reuses the live session instead of starting a second one beside it; the
// headless tests read it there too.
const devWindow = (import.meta.env.DEV && typeof window !== 'undefined' ? window : null) as unknown as { snarkHost?: HostSession } | null;
export const host: HostSession = devWindow ? (devWindow.snarkHost ??= new HostSession()) : new HostSession();
