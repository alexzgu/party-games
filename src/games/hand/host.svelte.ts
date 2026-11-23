import { HostLink } from '../../lib/room/host-link.svelte';
import { newCode, newPid } from '../../lib/room/code';
import { handPacks } from '../../lib/content';
import { record } from '../../lib/history';
import { Bots, isBot } from '../../lib/room/bots';
import { handBrain } from './bot';
import { filled } from './cards';
import * as L from './logic';
import { view } from './view';
import { readToHost, type ToHost } from './protocol';
import * as store from './store';
import { roomCards, type RoomCards } from './pack';

/** The chosen packs that exist; every pack when none of them does. */
export function chosenPacks(ids: string[]) {
  const all = handPacks();
  const some = all.filter((p) => ids.includes(p.id));
  return some.length ? some : all;
}

/** The room's cards for `players` players: the picks', topped up from other packs when they would stall (pack.ts). */
export const content = (ids: string[], players: number): RoomCards => roomCards(handPacks(), ids, players);

class Session {
  game = $state.raw<L.Game | null>(null);
  now = $state(Date.now());
  private timer?: ReturnType<typeof setInterval>;
  private lastSkip = -Infinity;
  private link = new HostLink('hand', {
    hello: (pid, name, online) => {
      if (!this.game) return { error: 'This room is closed.' };
      const joined = L.join(this.game, pid, name, online);
      if (joined.error !== undefined) return { error: joined.error };
      return { pid: joined.pid, then: () => {
        if (joined.game === this.game) this.send(joined.pid);
        else this.commit(joined.game);
      } };
    },
    message: (pid, raw) => this.receive(pid, raw),
    left: (pid) => {
      if (!this.game) return;
      this.commit(L.leave(this.game, pid));
      this.tick();
    },
    taken: () => {
      if (this.game?.phase !== 'lobby' || this.game.players.some((p) => !isBot(p.pid))) return null;
      this.commit({ ...this.game, code: newCode() });
      return this.game.code;
    },
  });

  /** Bots among the game's players; one that cannot be seated again leaves the game. */
  private bots = new Bots(this.link, handBrain, () => this.game?.players.map((p) => ({ pid: p.pid, name: p.name, out: this.game!.kicked.includes(p.pid) })) ?? [],
    (pid) => this.kick(pid));

  get online() { return this.link.online; }
  get status() { return this.link.status; }
  get trouble() { return this.link.trouble; }

  open() {
    if (this.game) return;
    const old = store.loadGame();
    this.now = Date.now();
    this.game = old ? L.afterReload(old, this.now) : L.newGame(newPid(), newCode(), store.loadSettings());
    store.saveGame(this.game);
    this.link.open(this.game.code);
    this.bots.open();
    this.timer = setInterval(() => this.tick(), 250);
  }

  private send(pid: string) {
    if (this.game) this.link.send(pid, { t: 'view', v: view(this.game, Date.now(), pid) });
  }

  private apply(g: L.Game, pid: string, m: ToHost): L.Game {
    const now = Date.now();
    switch (m.t) {
      case 'play': return L.play(g, pid, m.at, m.cards, m.texts);
      case 'spot': return L.spot(g, pid, m.at, m.i);
      case 'pick': return L.pick(g, pid, m.at, m.i, now);
      case 'vote': return L.vote(g, pid, m.at, m.i);
      case 'trade': return L.trade(g, pid, m.n, m.cards, Math.random);
    }
  }

  private receive(pid: string, raw: unknown) {
    const m = readToHost(raw);
    if (!m || !this.game) return;
    const next = this.apply(this.game, pid, m);
    if (next !== this.game) this.commit(next);
    else {
      this.send(pid);
      // The phone showed its play, pick, vote or trade at once: tell it this one did not count.
      if (m.t !== 'spot') this.link.send(pid, { t: 'refused', m: m.t });
    }
    this.tick();
  }

  private history(g: L.Game, finished: boolean) {
    if (!g.results.length) return;
    const scores = L.standings(g).map(({ name, score }) => ({ name, score }));
    const top = scores.filter((s) => s.score === scores[0]?.score).map((s) => s.name);
    const title = g.house >= g.settings.target ? 'The house won: everyone lost' : top.join(' & ') + (finished ? ' won' : ' led');
    const name = (pid: string) => pid === L.HOUSE ? 'The house' : g.players.find((p) => p.pid === pid)?.name ?? 'Player';
    record({ game: 'hand', title, finished, scores, packs: chosenPacks(g.settings.packs).map((p) => p.name),
      details: g.results.map((w) => `${name(w.by)}: ${filled(w.prompt, w.texts)}`) });
  }

  private commit(next: L.Game) {
    if (next === this.game) return;
    const finished = next.phase === 'over' && this.game?.phase !== 'over';
    this.game = next;
    store.saveGame(next);
    if (finished) this.history(next, true);
    for (const pid of this.link.pids()) this.send(pid);
  }

  private tick() {
    this.now = Date.now();
    if (this.game) this.commit(L.tick(this.game, this.now, this.online));
  }

  start() {
    const g = this.game;
    const c = g && content(g.settings.packs, L.active(g).length);
    if (!g || !c || !L.canStart(g) || c.problem) return;
    this.commit(L.start(g, { prompts: c.prompts, answers: c.answers }, Date.now()));
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
    this.commit(L.step(this.game, now, this.online));
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
    const g = this.game;
    if (!g) return;
    const fresh = L.newGame(newPid(), g.code, store.loadSettings());
    this.commit({ ...fresh, at: g.at + 1, players: L.active(g).map((p) => ({ ...p, score: 0 })), kicked: g.kicked.filter((x) => !g.left.includes(x)) });
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
    store.saveGame(null);
  }
}

export const host = new Session();
