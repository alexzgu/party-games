import { saladPacks } from '../../lib/content';
import { record } from '../../lib/history';
import { HostLink } from '../../lib/room/host-link.svelte';
import { newCode } from '../../lib/room/code';
import { seatIn } from '../../lib/room/seats';
import { Bots, isBot } from '../../lib/room/bots';
import { saladBrain } from './bot';
import * as L from './logic';
import { readToHost } from './protocol';
import { loadRoom, loadSettings, saveGame, saveSettings, type Settings } from './store';
import { playerView } from './view';

function selected(ids: string[]) {
  const packs = saladPacks().filter((p) => ids.includes(p.id));
  return packs.length ? packs : saladPacks().filter((p) => p.id === 'classic');
}
export const packNames = (ids: string[]) => selected(ids).map((p) => p.name);
const poolFor = (ids: string[]) => selected(ids).flatMap((p) => p.secrets);

function recordGame(g: L.Game, finished: boolean) {
  const scores = L.present(g).sort((a, b) => b.score - a.score).map(({ name, score }) => ({ name, score }));
  record({
    game: 'salad', title: `The room solved ${g.solved} of ${g.total} secrets`, scores,
    packs: packNames(g.packIds), details: g.log, finished,
  });
}

class HostSession {
  game = $state.raw<L.Game | null>(null);
  now = $state(Date.now());
  private ticker: ReturnType<typeof setInterval> | null = null;
  readonly link = new HostLink('salad', {
    hello: (pid, name, online) => {
      if (!this.game) return { error: 'This room is closed.' };
      const result = L.join(this.game, pid, name, online);
      if (result.error !== undefined) return { error: result.error };
      return { ...seatIn(this.game.players, result), then: () => {
        if (result.game === this.game) this.sendView(result.pid);
        else this.commit(result.game);
      } };
    },
    message: (pid, raw) => this.receive(pid, raw),
    known: (pid) => !!this.game?.players.some((p) => p.pid === pid),
    left: (pid) => {
      if (!this.game) return;
      this.commit(L.leave(this.game, pid));
      this.tick();
    },
    vacant: () => this.game?.phase === 'lobby' && L.present(this.game).every((p) => isBot(p.pid)),
    move: (code) => this.commit({ ...this.game!, code }),
  });

  /** Bots among the game's players; one that cannot be seated again leaves the game. */
  private bots = new Bots(this.link, saladBrain, () => this.game?.players.map((p) => ({ pid: p.pid, name: p.name, out: p.kicked })) ?? [],
    (pid) => this.kick(pid));

  get running() { return this.game !== null; }
  get status() { return this.link.status; }
  get trouble() { return this.link.trouble; }
  get online() { return this.link.online; }

  /** Only in the tab that owns the game's saved room (owner.ts); another tab opens nothing. */
  async open(): Promise<void> {
    if (this.game || !(await this.link.own()) || this.game) return;
    const { game: saved, room } = loadRoom();
    const { packIds, awayMs } = loadSettings();
    const g = saved ? L.afterReload(saved, Date.now())
      : L.newGame(newCode(), packIds, poolFor(packIds), Math.floor(Math.random() * 4294967296), awayMs);
    this.link.open(g.code, room);
    this.commit(g);
    this.bots.open();
    this.ticker = setInterval(() => this.tick(), 250);
  }

  private sendView(pid: string): void {
    if (this.game) this.link.send(pid, { t: 'view', v: playerView(this.game, pid, Date.now()) });
  }

  private commit(next: L.Game): void {
    if (next === this.game) return;
    if (next.phase === 'over' && !next.recorded) {
      recordGame(next, true);
      next = { ...next, recorded: true };
    }
    this.game = next;
    saveGame(next, this.link.room);
    for (const pid of this.link.pids()) this.sendView(pid);
  }

  private tick(): void {
    this.now = Date.now();
    if (this.game) this.commit(L.tick(this.game, this.now, this.online));
  }

  private receive(pid: string, raw: unknown): void {
    const msg = readToHost(raw);
    if (!this.game || !msg) return;
    this.tick();
    const next = L.fromPhone(this.game, pid, msg, Date.now());
    if (next === this.game) this.sendView(pid);
    else this.commit(next);
    this.tick();
  }

  start(): void {
    const g = this.game;
    if (g && L.canStart(g)) this.commit(L.startRound(g, Date.now()));
  }
  skip(): void { if (this.game) this.commit(L.step(this.game, Date.now(), this.online)); }
  pause(): void { if (this.game) this.commit(L.pause(this.game, Date.now())); }
  resume(): void { if (this.game) this.commit(L.resume(this.game, Date.now())); }
  /** Seats a bot (a pretend phone this screen plays); why not, when the room refuses it. */
  addBot(): string | null { return this.game ? this.bots.add() : null; }

  rematch(): void { if (this.game?.phase === 'over') this.commit(L.rematch(this.game)); }
  rebroker(): void { if (this.game) this.link.rebroker(); }

  kick(pid: string): void {
    if (!this.game) return;
    this.commit(L.kick(this.game, pid));
    this.link.remove(pid, 'The host removed you from this game.');
    this.tick();
  }

  /** Packs change only in the lobby; the presenter wait applies at once. */
  settings(s: Settings): void {
    saveSettings(s);
    if (!this.game) return;
    const packs = this.game.phase === 'lobby' ? { packIds: s.packIds, pool: poolFor(s.packIds) } : {};
    this.commit({ ...this.game, ...packs, awayMs: s.awayMs });
  }

  end(): void {
    if (this.game && !this.game.recorded && this.game.total) recordGame(this.game, false);
    this.link.close();
    this.bots.close();
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    this.game = null;
    saveGame(null, '');
  }
}

export const host = new HostSession();
