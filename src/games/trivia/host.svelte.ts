import { HostLink } from '../../lib/room/host-link.svelte';
import { newCode, newPid } from '../../lib/room/code';
import { seatIn } from '../../lib/room/seats';
import { triviaPacks } from '../../lib/content';
import { record } from '../../lib/history';
import { Bots, isBot } from '../../lib/room/bots';
import { triviaBrain } from './bot';
import * as L from './logic';
import { pickedPacks, roomQuestions } from './pack';
import { readToHost } from './protocol';
import { view } from './view';
import * as store from './store';

/** The packs a room with these picks asks from (pack.ts: Classic when none of them exists). */
export const chosenPacks = (ids: string[]) => pickedPacks(triviaPacks(), ids);

/** One History line: "Science: What gas do plants take in from the air? Carbon dioxide (3 of 5 right)". */
const line = (p: L.Past): string => `${p.category}: ${p.question} ${p.right} (${p.correct} of ${p.of} right)`;

class Session {
  game = $state.raw<L.Game | null>(null);
  now = $state(Date.now());
  private timer?: ReturnType<typeof setInterval>;
  private lastSkip = -Infinity;
  readonly link = new HostLink('trivia', {
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
      this.commit(L.leave(this.game, pid));
      this.tick();
    },
    vacant: () => this.game?.phase === 'lobby' && this.game.players.every((p) => isBot(p.pid)),
    move: (code) => this.commit({ ...this.game!, code }),
  });

  /** Bots among the game's players; one that cannot be seated again leaves the game. The host tells a bot the right answer only to play at its rate (bot.ts). */
  private bots = new Bots(this.link, () => triviaBrain((n) => (this.game?.round?.n === n ? this.game.round.q.right : null)),
    () => this.game?.players.map((p) => ({ pid: p.pid, name: p.name, out: this.game!.kicked.includes(p.pid) })) ?? [],
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
    const { game, refused } = L.tap(g, pid, m.at, m.n, m.choice, Date.now());
    if (game !== g) this.commit(game);
    else this.send(pid);
    // The phone showed its tap at once: tell it this one did not count.
    if (refused) this.link.send(pid, { t: 'refused', m: m.t });
    this.tick();
  }

  private history(g: L.Game, finished: boolean) {
    if (!g.results.length) return;
    const scores = L.standings(g).map(({ name, score }) => ({ name, score }));
    const top = scores.filter((s) => s.score === scores[0]?.score).map((s) => s.name);
    record({ game: 'trivia', title: top.join(' & ') + (finished ? ' won' : ' led'), finished, scores,
      packs: chosenPacks(g.settings.packs).map((p) => p.name), details: g.results.map(line) });
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
    if (this.game) this.commit(L.tick(this.game, this.now, this.online));
  }

  start() {
    const g = this.game;
    if (!g || !L.canStart(g)) return;
    this.commit(L.start(g, roomQuestions(triviaPacks(), g.settings.packs), Date.now()));
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
    this.commit(L.kick(this.game, pid));
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
    if (this.game && this.game.phase !== 'over') this.history(this.game, false);
    this.link.close();
    this.bots.close();
    clearInterval(this.timer);
    this.game = null;
    store.saveGame(null, '');
  }
}

export const host = new Session();
