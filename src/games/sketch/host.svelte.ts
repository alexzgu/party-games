// The host screen's session: the room link, the saved game and its drawings, and the clock.
import { HostLink } from '../../lib/room/host-link.svelte';
import { newCode, newPid } from '../../lib/room/code';
import { seatIn } from '../../lib/room/seats';
import { sketchPacks } from '../../lib/content';
import { record } from '../../lib/history';
import { Bots, isBot } from '../../lib/room/bots';
import { sketchBrain } from './bot';
import { shuffle } from '../../lib/random';
import type { Drawing } from '../../lib/ink';
import { active, newGame, standings, type Game, type Settings } from './core';
import * as L from './logic';
import * as T from './telephone';
import * as G from './guess';
import { latinSquare } from './square';
import { SPARE_IDEAS, SPARE_WORDS, deal } from './spare';
import { apply } from './live';
import { artIds, inkId, view } from './view';
import { ink, readToHost, type Ink } from './protocol';
import * as store from './store';

/** Live ink is saved at most this often (a reload of the host gets the rest from the drawer's phone). */
const SAVE_INK_MS = 1000;

class Session {
  game = $state.raw<Game | null>(null);
  art = $state.raw<Record<string, Drawing>>({});
  now = $state(Date.now());
  /** The number of the last live ink applied, per drawing. */
  private seq = new Map<string, number>();
  private unsaved = false;
  private savedAt = 0;
  private timer?: ReturnType<typeof setInterval>;
  private lastSkip = -Infinity;
  readonly link = new HostLink('sketch', {
    hello: (pid, name, online) => {
      const joined = L.join(this.game!, pid, name, online);
      if (joined.error !== undefined) return { error: joined.error };
      return { ...seatIn(this.game!.players, joined), then: () => {
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
    vacant: () => this.game?.phase === 'lobby' && this.game.players.every((p) => isBot(p.pid)),
    // A new room: its own game id too, so its drawings' ids are never another room's.
    move: (code) => this.commit({ ...this.game!, code, id: newPid() }),
  });

  /** Bots among the game's players; one that cannot be seated again leaves the game. */
  private bots = new Bots(this.link, sketchBrain, () => this.game?.players.map((p) => ({ pid: p.pid, name: p.name, out: this.game!.kicked.includes(p.pid) })) ?? [],
    (pid) => this.kick(pid));

  get online() { return this.link.online; }
  get trouble() { return this.link.trouble; }

  /** Only in the tab that owns the game's saved room (owner.ts); another tab opens nothing. */
  async open(): Promise<void> {
    if (this.game || !(await this.link.own()) || this.game) return;
    const { game: old, room } = store.loadRoom();
    this.art = old ? store.loadArt(room) : {};
    this.now = Date.now();
    this.game = old ? L.afterReload(old, this.now) : newGame(newPid(), newCode(), store.loadSettings());
    this.link.open(this.game.code, room);
    store.saveGame(this.game, this.link.room);
    this.saveArt(); // under the room's id now, which a lost seat record has made new
    this.bots.open();
    this.timer = setInterval(() => this.tick(), 250);
  }

  private send(pid: string) {
    if (this.game) this.link.send(pid, { t: 'view', v: view(this.game, Date.now(), pid, this.online) });
  }

  private receive(pid: string, raw: unknown) {
    const g = this.game;
    const m = readToHost(raw);
    if (!m || !g) return;
    if (m.t === 'art?') return this.lend(g, pid, m.id);
    if (m.t === 'ink') return this.ink(g, pid, m);
    // The clock first (a timer may have run out), then the message on the game as it is now: a
    // hint falling due must not swallow a guess. One meant for an ended phase fails its `at` check.
    this.tick();
    const now = Date.now();
    const cur = this.game!;
    const id = T.task(cur, pid)?.id;
    const next = L.act(cur, pid, m, now);
    if (m.t === 'draw' && id && next !== cur && m.d.length) this.keep(id, m.d, true);
    if (next === cur) this.send(pid);
    else this.commit(next);
    this.tick();
  }

  /** A phone asks for a drawing it shows. */
  private lend(g: Game, pid: string, id: string) {
    // A drawing not here yet (live, nothing drawn) or lost (storage full) goes out blank, so no
    // phone waits on "Loading drawing…" for ever.
    if (artIds(view(g, Date.now(), pid)).includes(id)) this.link.send(pid, { t: 'art', id, d: this.art[id] ?? [], n: this.seq.get(id) });
  }

  /** The drawer's live ink: kept, shown here and passed on to every other phone. */
  private ink(g: Game, pid: string, m: Ink) {
    // Paused: dropped; the next ink then misses a number and the host asks for the whole drawing.
    if (g.phase !== 'guess' || !g.dg || g.dg.drawer !== pid || m.at !== g.at || g.frozen !== null) return;
    const id = inkId(g);
    const known = this.seq.get(id);
    if (!('all' in m) && known !== m.n - 1) return this.link.send(pid, { t: 'ink?' });
    const d = 'all' in m ? m.all : ink(apply(this.art[id] ?? [], m));
    if (!d) return;
    this.seq.set(id, m.n);
    this.keep(id, d, false);
    const out = 'all' in m ? { t: 'art', id, d, n: m.n } : { t: 'ink', id, n: m.n, i: m.i, o: m.o, d: m.d };
    for (const other of this.link.pids()) if (other !== pid) this.link.send(other, out);
  }

  private keep(id: string, d: Drawing, now: boolean) {
    this.art = { ...this.art, [id]: d };
    this.unsaved = true;
    if (now) this.saveArt();
  }

  private saveArt() {
    store.saveArt(this.art, this.link.room);
    this.unsaved = false;
    this.savedAt = Date.now();
  }

  private history(g: Game, finished: boolean) {
    const packs = sketchPacks().filter((p) => g.settings.packs.includes(p.id)).map((p) => p.name);
    if (g.tel) {
      if (finished) record({ game: 'sketch', title: `Telephone · ${g.tel.order.length} chains`, scores: [], packs, details: T.chainLines(g.tel) });
      return;
    }
    if (!g.dg || (!finished && !g.players.some((p) => p.score))) return;
    const scores = standings(g).map(({ name, score }) => ({ name, score }));
    const leaders = scores.filter((s) => s.score === scores[0]?.score).map((s) => s.name);
    record({ game: 'sketch', title: `Draw & guess: ${leaders.join(' & ')}${finished ? ' won' : ' led'}`, finished, scores, packs });
  }

  private commit(next: Game) {
    if (next === this.game) return;
    const ends = (x: Game | null) => x?.phase === 'over' || x?.phase === 'album';
    const finished = ends(next) && !ends(this.game);
    this.game = next;
    store.saveGame(next, this.link.room);
    if (finished) this.history(next, true);
    // Draw & guess shows a turn's drawing until the reveal ends; then it is dropped.
    if (next.dg && next.phase !== 'guess' && next.phase !== 'reveal' && Object.keys(this.art).length) {
      this.art = {};
      this.seq.clear();
      this.saveArt();
    }
    for (const pid of this.link.pids()) this.send(pid);
  }

  private tick() {
    this.now = Date.now();
    if (this.game) this.commit(L.tick(this.game, this.now, this.online));
    if (this.unsaved && this.now - this.savedAt >= SAVE_INK_MS) this.saveArt();
  }

  start() {
    const g = this.game;
    if (!g || !L.canStart(g)) return;
    const all = sketchPacks();
    const chosen = all.filter((p) => g.settings.packs.includes(p.id));
    const packs = chosen.length ? chosen : all;
    const order = active(g).map((p) => p.pid);
    const now = Date.now();
    this.commit(g.settings.mode === 'telephone'
      ? T.startTelephone(g, order, latinSquare(order.length), deal(packs.flatMap((p) => p.ideas), SPARE_IDEAS, shuffle), now)
      : G.startGuess(g, deal(packs.flatMap((p) => p.words), SPARE_WORDS, shuffle), now));
  }

  settings(settings: Settings) {
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
    this.commit(L.skip(this.game, now, this.online));
  }

  /** The album's next (1) or previous (-1) entry. */
  page(dir: 1 | -1) {
    if (this.game) this.commit(T.turnPage(this.game, dir));
  }

  kick(pid: string) {
    if (!this.game) return;
    this.link.remove(pid, 'The host removed you from this room.');
    this.commit(L.kick(this.game, pid));
  }

  /** Seats a bot (a pretend phone this screen plays); why not, when the room refuses it. */
  addBot(): string | null { return this.game ? this.bots.add() : null; }

  /** Play again: the same room and players, back in the lobby with the settings now chosen. */
  rematch() {
    const g = this.game;
    if (!g) return;
    this.art = {};
    this.seq.clear();
    this.saveArt();
    this.commit({ ...newGame(newPid(), g.code, store.loadSettings()), at: g.at + 1,
      players: active(g).map((p) => ({ ...p, score: 0 })), kicked: g.kicked, left: g.left });
  }

  /** A new broker: phones rejoin through the new QR code, so they get the reconnect grace. */
  rebroker() {
    this.link.rebroker();
    if (this.game) this.commit(L.regrace(this.game, Date.now()));
  }

  close() {
    if (this.game && this.game.phase !== 'over' && this.game.phase !== 'album') this.history(this.game, false);
    this.link.close();
    this.bots.close();
    clearInterval(this.timer);
    this.game = null;
    this.art = {};
    this.seq.clear();
    store.saveGame(null, '');
    store.clearArt();
  }
}

export const host = new Session();
