import { HostLink } from '../../lib/room/host-link.svelte';
import { newCode, newPid } from '../../lib/room/code';
import { seatIn } from '../../lib/room/seats';
import { brawlPacks } from '../../lib/content';
import { record } from '../../lib/history';
import { consent, stillAsked } from '../../lib/lend';
import { Bots, isBot } from '../../lib/room/bots';
import { brawlBrain } from './bot';
import * as L from './logic';
import { artIds, view } from './view';
import { readToHost } from './protocol';
import * as store from './store';
import { dealTitles, roomTitles, type RoomTitles } from './pack';
import type { Drawing } from '../../lib/ink';

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** The room's titles for `players` players: the picks', and the packs that would lend when they are too few (pack.ts). */
export const content = (ids: string[], players: number): RoomTitles => roomTitles(brawlPacks(), ids, players);

class Session {
  game = $state.raw<L.Game | null>(null);
  art = $state.raw<Record<string, Drawing>>({});
  now = $state(Date.now());
  /** The question about lending packs the host said yes to in this room (its key), or ''. */
  agreed = $state('');
  /** The question about lending packs put to the host after Start (its key) while it still stands, or ''. */
  asked = $state('');
  private timer?: ReturnType<typeof setInterval>;
  private lastSkip = -Infinity;
  readonly link = new HostLink('brawl', {
    hello: (pid, name, online) => {
      const joined = L.join(this.game!, pid, name, online);
      if (joined.error !== undefined) return { error: joined.error };
      return { ...seatIn(this.game!.players, joined), then: () => {
        if (joined.game === this.game) this.send(joined.pid);
        else this.commit(joined.game);
      } };
    },
    message: (pid, raw) => this.receive(pid, raw),
    known: (pid) => !!this.game && (this.game.players.some((p) => p.pid === pid) || this.game.kicked.includes(pid) || !!this.game.left?.includes(pid)),
    left: (pid) => {
      if (!this.game) return;
      this.commit(L.leave(this.game, pid));
      this.tick();
    },
    vacant: () => this.game?.phase === 'lobby' && this.game.players.every((p) => isBot(p.pid)),
    move: (code) => this.commit({ ...this.game!, code }),
  });

  /** Bots among the game's players; one that cannot be seated again leaves the game. */
  private bots = new Bots(this.link, brawlBrain, () => this.game?.players.map((p) => ({ pid: p.pid, name: p.name, out: this.game!.kicked.includes(p.pid) })) ?? [],
    (pid) => this.kick(pid));

  get online() { return this.link.online; }
  get status() { return this.link.status; }
  get trouble() { return this.link.trouble; }

  /** Only in the tab that owns the game's saved room (owner.ts); another tab opens nothing. */
  async open(): Promise<void> {
    if (this.game || !(await this.link.own()) || this.game) return;
    const { game: old, room } = store.loadRoom();
    this.art = old ? store.loadArt() : {};
    this.now = Date.now();
    this.agreed = '';
    this.asked = '';
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
    const g = this.game;
    const m = readToHost(raw);
    if (!m || !g) return;
    if (m.t === 'art?') {
      const d = this.art[m.id];
      if (d && artIds(view(g, Date.now(), pid)).includes(m.id)) this.link.send(pid, { t: 'art', id: m.id, d });
      return;
    }
    this.tick();
    if (this.game !== g) {
      this.send(pid);
      return;
    }
    let next = g;
    if (m.t === 'draw') {
      const t = L.task(g, pid);
      next = L.submit(g, pid, m.at, m.name);
      if (t && next !== g) {
        this.art = { ...this.art, [t.id]: m.d };
        store.saveArt(this.art);
      }
    } else if (m.t === 'vote') next = L.vote(g, pid, m.at, m.side);
    else next = L.tag(g, pid, m.at, m.id);
    if (next === g) this.send(pid);
    else this.commit(next);
    this.tick();
  }

  private history(g: L.Game, finished: boolean) {
    if (!finished && !g.results.length) return;
    const scores = L.standings(g).map(({ name, score }) => ({ name, score }));
    const leaders = scores.filter((s) => s.score === scores[0]?.score).map((s) => s.name);
    record({ game: 'brawl', title: leaders.join(' & ') + (finished ? ' won' : ' led'), finished, scores,
      packs: [...content(g.settings.packs, 0).packs.map((p) => p.name), ...(g.lent ?? [])] });
  }

  private commit(next: L.Game) {
    if (next === this.game) return;
    const finished = next.phase === 'over' && this.game?.phase !== 'over';
    this.game = next;
    this.asked = stillAsked(this.asked, next.phase === 'lobby' ? content(next.settings.packs, L.active(next).length).ask : null);
    store.saveGame(next, this.link.room);
    if (finished) this.history(next, true);
    for (const pid of this.link.pids()) this.send(pid);
  }

  private ring = () => this.game ? shuffle(L.active(this.game).map((p) => p.pid)) : [];

  private tick() {
    this.now = Date.now();
    if (this.game) this.commit(L.tick(this.game, this.now, this.online, this.ring));
  }

  /**
   * Starts the game, unless other packs would lend and the host has not said yes to that question
   * (`yes` is its key, from the popup): then nothing starts and the question is put to the host.
   */
  start(yes = '') {
    const g = this.game;
    const c = g && content(g.settings.packs, L.active(g).length);
    if (!g || !c || !L.canStart(g) || c.problem) return;
    const agreed = consent(c.ask, this.agreed, yes);
    if (agreed === null) {
      this.asked = c.ask!.key;
      return;
    }
    this.agreed = agreed;
    this.commit(L.startRound({ ...g, titles: dealTitles(c, !!c.ask, shuffle), lent: c.ask?.lenders }, this.ring(), Date.now()));
  }

  /** The host closed the question without an answer. */
  dismiss() { this.asked = ''; }

  settings(settings: L.Settings) {
    store.saveSettings(settings);
    if (this.game?.phase === 'lobby') this.commit({ ...this.game, settings });
  }

  pause() {
    const g = this.game;
    if (!g || g.deadline === null) return;
    this.commit(g.frozen === null ? L.pause(g, Date.now()) : L.resume(g, Date.now()));
  }

  skip() {
    const now = Date.now();
    if (!this.game || now - this.lastSkip < 800) return;
    this.lastSkip = now;
    this.commit(L.step(this.game, now, this.ring));
  }

  kick(pid: string) {
    if (!this.game) return;
    this.link.remove(pid, 'The host removed you from this room.');
    this.commit(L.kick(this.game, pid));
  }

  /** Seats a bot (a pretend phone this screen plays); why not, when the room refuses it. */
  addBot(): string | null { return this.game ? this.bots.add() : null; }

  rematch() {
    if (this.game) this.commit(L.rematch(this.game, newPid()));
  }

  rebroker() { this.link.rebroker(); }

  close() {
    if (this.game && this.game.phase !== 'over') this.history(this.game, false);
    this.link.close();
    this.bots.close();
    clearInterval(this.timer);
    this.game = null;
    this.art = {};
    this.agreed = '';
    this.asked = '';
    store.saveGame(null, '');
    store.clearArt();
  }
}

export const host = new Session();
