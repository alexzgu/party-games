import { HostLink } from '../../lib/room/host-link.svelte';
import { newCode, newPid } from '../../lib/room/code';
import { seatIn } from '../../lib/room/seats';
import { record } from '../../lib/history';
import { rankPlural } from '../../lib/cards/deck';
import { Bots, isBot } from '../../lib/room/bots';
import { fishBrain } from './bot';
import * as L from './logic';
import { readToHost } from './protocol';
import { view } from './view';
import * as store from './store';

class Session {
  game = $state.raw<L.Game | null>(null);
  now = $state(Date.now());
  private timer?: ReturnType<typeof setInterval>;
  private lastSkip = -Infinity;
  readonly link = new HostLink('fish', {
    hello: (pid, name, online) => {
      if (!this.game) return { error: 'This room is closed.' };
      const joined = L.join(this.game, pid, name, online);
      if (joined.error !== undefined) return { error: joined.error };
      return { ...seatIn(this.game.players, joined), then: () => {
        if (joined.game === this.game) this.send(joined.pid);
        else this.commit(joined.game);
      } };
    },
    message: (pid, raw) => this.receive(pid, raw),
    known: (pid) => !!this.game && (this.game.players.some((p) => p.pid === pid) || this.game.kicked.includes(pid) || this.game.left.includes(pid)),
    left: (pid) => {
      if (!this.game) return;
      this.commit(L.leave(this.game, pid, Date.now()));
      this.tick();
    },
    vacant: () => this.game?.phase === 'lobby' && this.game.players.every((p) => isBot(p.pid)),
    move: (code) => this.commit({ ...this.game!, code }),
  });

  /** Bots among the game's players; one that cannot be seated again leaves the game. */
  private bots = new Bots(this.link, fishBrain, () => this.game?.players.map((p) => ({ pid: p.pid, name: p.name, out: this.game!.kicked.includes(p.pid) })) ?? [],
    (pid) => this.kick(pid));

  get online() { return this.link.online; }
  get status() { return this.link.status; }
  get trouble() { return this.link.trouble; }

  /** Only in the tab that owns the game's saved room (owner.ts); another tab opens nothing. */
  async open(): Promise<void> {
    if (this.game || !(await this.link.own()) || this.game) return;
    const { game: old, room } = store.loadRoom();
    this.now = Date.now();
    this.game = old ? L.afterReload(old, this.now) : L.newGame(newPid(), newCode(), store.loadSettings());
    this.link.open(this.game.code, room);
    store.saveGame(this.game, this.link.room);
    this.bots.open();
    this.timer = setInterval(() => this.tick(), 250);
  }

  private send(pid: string) {
    if (this.game) this.link.send(pid, { t: 'view', v: view(this.game, Date.now(), pid) });
  }

  private receive(pid: string, raw: unknown) {
    const m = readToHost(raw);
    const g = this.game;
    if (!m || !g) return;
    const game = L.ask(g, pid, m.at, m.to, m.rank, Date.now());
    if (game !== g) this.commit(game);
    else {
      this.send(pid);
      // The phone showed its ask at once: tell it this one did not count.
      this.link.send(pid, { t: 'refused', m: m.t });
    }
  }

  /** One History entry: the books each player laid down. */
  private history(g: L.Game, finished: boolean) {
    if (!g.seats.length) return;
    const books = (pid: string) => g.books[pid] ?? [];
    const scores = L.standings(g).map((p) => ({ name: p.name, score: books(p.pid).length }));
    const top = scores.filter((s) => s.score === scores[0]?.score).map((s) => s.name);
    const details = g.seats.map((pid) => {
      const name = g.players.find((p) => p.pid === pid)?.name ?? '';
      const laid = books(pid);
      return `${name}: ${laid.length ? laid.map(rankPlural).join(', ') : 'no books'}`;
    });
    record({ game: 'fish', title: top.join(' & ') + (finished ? ' won' : ' led'), finished, scores, packs: [], details });
  }

  private commit(next: L.Game) {
    if (next === this.game) return;
    const finished = next.phase === 'over' && this.game?.phase !== 'over';
    this.game = next;
    store.saveGame(next, this.link.room);
    if (finished) this.history(next, true);
    for (const pid of this.link.pids()) this.send(pid);
  }

  private tick() {
    this.now = Date.now();
    if (this.game) this.commit(L.tick(this.game, this.now));
  }

  start() {
    const g = this.game;
    if (!g || !L.canStart(g)) return;
    this.commit(L.start(g, Date.now()));
  }

  settings(settings: L.Settings) {
    store.saveSettings(settings);
    if (this.game?.phase === 'lobby') this.commit({ ...this.game, settings });
  }

  pause() {
    const g = this.game;
    if (!g) return;
    this.commit(g.paused === null ? L.pause(g, Date.now()) : L.resume(g, Date.now()));
  }

  skip() {
    const now = Date.now();
    if (!this.game || now - this.lastSkip < 800) return;
    this.lastSkip = now;
    this.commit(L.step(this.game, now));
  }

  kick(pid: string) {
    if (!this.game) return;
    this.link.remove(pid, 'The host removed you from this room.');
    this.commit(L.kick(this.game, pid, Date.now()));
    this.tick();
  }

  /** Seats a bot (a pretend phone this screen plays); why not, when the room refuses it. */
  addBot(): string | null { return this.game ? this.bots.add() : null; }

  rematch() {
    if (this.game) this.commit(L.rematch(this.game, newPid(), store.loadSettings()));
  }

  rebroker() {
    this.link.rebroker();
    if (this.game) this.commit(L.quiet(this.game, Date.now()));
  }

  close() {
    if (this.game && this.game.phase !== 'over' && this.game.phase !== 'lobby') this.history(this.game, false);
    this.link.close();
    this.bots.close();
    clearInterval(this.timer);
    this.game = null;
    store.saveGame(null, '');
  }
}

export const host = new Session();
