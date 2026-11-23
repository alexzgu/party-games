import { HostLink } from '../../lib/room/host-link.svelte';
import { newCode, newPid } from '../../lib/room/code';
import { brawlPacks } from '../../lib/content';
import { record } from '../../lib/history';
import * as L from './logic';
import { artIds, view } from './view';
import { readToHost } from './protocol';
import * as store from './store';
import type { Drawing } from '../../lib/ink';

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

class Session {
  game = $state.raw<L.Game | null>(null);
  art = $state.raw<Record<string, Drawing>>({});
  now = $state(Date.now());
  private timer?: ReturnType<typeof setInterval>;
  private lastSkip = -Infinity;
  private link = new HostLink('brawl', {
    hello: (pid, name, online) => {
      const joined = L.join(this.game!, pid, name, online);
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
      if (this.game?.phase !== 'lobby' || this.game.players.length) return null;
      const code = newCode();
      this.commit({ ...this.game, code });
      return code;
    },
  });

  get online() { return this.link.online; }
  get status() { return this.link.status; }
  get trouble() { return this.link.trouble; }

  open() {
    if (this.game) return;
    const old = store.loadGame();
    this.art = old ? store.loadArt() : {};
    this.now = Date.now();
    this.game = old ? L.afterReload(old, this.now) : L.newGame(newPid(), newCode(), store.loadSettings());
    store.saveGame(this.game);
    this.link.open(this.game.code);
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
      packs: brawlPacks().filter((p) => g.settings.packs.includes(p.id)).map((p) => p.name) });
  }

  private commit(next: L.Game) {
    if (next === this.game) return;
    const finished = next.phase === 'over' && this.game?.phase !== 'over';
    this.game = next;
    store.saveGame(next);
    if (finished) this.history(next, true);
    for (const pid of this.link.pids()) this.send(pid);
  }

  private ring = () => this.game ? shuffle(L.active(this.game).map((p) => p.pid)) : [];

  private tick() {
    this.now = Date.now();
    if (this.game) this.commit(L.tick(this.game, this.now, this.online, this.ring));
  }

  start() {
    const g = this.game;
    if (!g || !L.canStart(g)) return;
    const packs = brawlPacks();
    const titles = packs.filter((p) => g.settings.packs.includes(p.id)).flatMap((p) => p.titles);
    this.commit(L.startRound({ ...g, titles: shuffle(titles.length ? titles : [...packs[0].titles]) }, this.ring(), Date.now()));
  }

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

  rematch() {
    const g = this.game;
    if (g) this.commit({ ...L.newGame(newPid(), g.code, g.settings), at: g.at + 1, players: L.active(g).map((p) => ({ ...p, score: 0 })), kicked: g.kicked });
  }

  rebroker() { this.link.rebroker(); }

  close() {
    if (this.game && this.game.phase !== 'over') this.history(this.game, false);
    this.link.close();
    clearInterval(this.timer);
    this.game = null;
    this.art = {};
    store.saveGame(null);
    store.clearArt();
  }
}

export const host = new Session();
