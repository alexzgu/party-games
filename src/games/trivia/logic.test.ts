import { describe, expect, it } from 'vitest';
import { GAMES } from '../../app.config';
import { seeded } from '../../lib/room/bots';
import * as L from './logic';
import { roomQuestions } from './pack';
import { parts, triviaKey } from './rules';
import { view } from './view';

const CATS = ['Science', 'History', 'Music'];
/** Lines numbered from 0, categories in turn unless one is given. */
const q = (i: number, cat = CATS[i % 3]) => `${cat} | What is fact number ${i}? | Right ${i} | Wrong ${i}a | Wrong ${i}b | Wrong ${i}c`;
const questions = Array.from({ length: 25 }, (_, i) => q(i));
const settings = (patch: Partial<L.Settings> = {}): L.Settings => ({ ...L.DEFAULT_SETTINGS, ...patch });
/** Answers always shown in the order written: the right one is A. */
const inOrder = () => 0.999;

function lobby(n = 3, patch: Partial<L.Settings> = {}) {
  let g = L.newGame('g', 'BCDF', settings(patch));
  for (let i = 0; i < n; i++) g = (L.join(g, `p${i}`, `P${i}`, new Set()) as { game: L.Game }).game;
  return g;
}
/** A game started at 0 and its first question's answers on screen at 3,000 (the 20 s timer ends at 23,000). */
const room = (n = 3, patch: Partial<L.Settings> = {}) => L.step(L.start(lobby(n, patch), questions, 0, inOrder), L.CATEGORY_MS);
const all = (g: L.Game) => new Set(g.players.map((p) => p.pid));
const tap = (g: L.Game, pid: string, choice: L.Choice, now = L.CATEGORY_MS) => L.answer(g, pid, g.at, g.round!.n, choice, now);
const score = (g: L.Game, pid: string) => g.players.find((p) => p.pid === pid)!.score;
const categories = (g: L.Game) => g.questions.map((x) => x.category);

describe('Smarty Pants questions in a game', () => {
  it("asks only the picked packs' questions, none twice, with the category changing whenever another is left", () => {
    const packs = [
      { id: 'mine', name: 'Mine', blurb: '', questions: [q(0, 'Science'), q(1, 'Science'), q(2, 'Science'), q(3, 'Music'), q(4, 'Music')] },
      { id: 'also', name: 'Also', blurb: '', questions: [q(1, 'Science'), q(5, 'History')] },
      { id: 'other', name: 'Other', blurb: '', questions: [q(9, 'History')] },
    ];
    for (let seed = 0; seed < 20; seed++) {
      const g = L.start(lobby(), roomQuestions(packs, ['mine', 'also'], seeded(seed)), 0);
      expect(g.questions.map((x) => x.question).sort()).toEqual([0, 1, 2, 3, 4, 5].map((i) => parts(q(i)).question));
      // A category repeats only when nothing else is left after it.
      const cats = categories(g);
      cats.forEach((c, i) => { if (i && c === cats[i - 1]) expect(cats.slice(i).every((x) => x === c)).toBe(true); });
    }
  });

  it('keeps changing category when only one category is left, by asking it in a row', () => {
    const g = L.start(lobby(), [q(0, 'Music'), q(1, 'Science'), q(2, 'Science'), q(3, 'Science')], 0);
    expect(categories(g)).toEqual(['Music', 'Science', 'Science', 'Science']);
    const spread = L.deal([q(0, 'Science'), q(1, 'Science'), q(2, 'Music'), q(3, 'Music')], [], 4).questions.map((x) => parts(x).category);
    expect(spread).toEqual(['Science', 'Music', 'Science', 'Music']);
  });

  it('asks new questions game after game, then starts over with the rest of the picks', () => {
    const pool = questions.slice(0, 12);
    let g = lobby();
    const games: string[][] = [];
    for (let i = 0; i < 2; i++) {
      g = L.start(g, pool, 0);
      games.push(g.questions.map((x) => x.question));
      for (let n = 1; n <= g.questions.length; n++) g = L.step(L.step(L.step(g, n), n), n);
      g = L.rematch(g, 'next', settings());
    }
    expect(new Set(games[0]).size).toBe(10);
    expect(new Set([...games[0], ...games[1].slice(0, 2)]).size).toBe(12); // the second game asks the 2 left first
    expect(new Set(games[1]).size).toBe(10);
    expect(g.asked.length).toBeLessThanOrEqual(12);
  });

  it("shuffles each question's answers once and remembers which is right", () => {
    const g = L.start(lobby(), [q(0)], 0, () => 0);
    const asked = g.questions[0];
    expect([...asked.answers].sort()).toEqual(['Right 0', 'Wrong 0a', 'Wrong 0b', 'Wrong 0c']);
    expect(asked.answers[asked.right]).toBe('Right 0');
    expect(asked.right).not.toBe(0);
    expect(g.asked).toEqual([triviaKey(q(0))]);
  });
});

describe('Smarty Pants rounds', () => {
  it('shows the category, then the question, each on its timer', () => {
    let g = L.start(lobby(), questions, 0);
    expect([g.phase, g.deadline]).toEqual(['category', L.CATEGORY_MS]);
    g = L.tick(g, L.CATEGORY_MS, all(g));
    expect([g.phase, g.deadline]).toEqual(['answer', L.CATEGORY_MS + 20_000]);
  });

  it('takes the first tap and never changes it', () => {
    const g = tap(room(), 'p0', 2);
    expect(g.round!.answers.p0.choice).toBe(2);
    expect(tap(g, 'p0', 0)).toBe(g);
    expect(L.tap(g, 'p0', g.at, 1, 2, 4000)).toEqual({ game: g, refused: false }); // its own tap again: no news
    expect(L.tap(g, 'p0', g.at, 1, 0, 4000)).toEqual({ game: g, refused: true });
  });

  it('counts nothing for another question, after the reveal, or from a player not in the game', () => {
    const g = room();
    expect(L.answer(g, 'p0', g.at + 1, 1, 0, 4000)).toBe(g); // another phase
    expect(L.answer(g, 'p0', g.at, 2, 0, 4000)).toBe(g); // another question
    expect(L.answer(L.start(lobby(), questions, 0), 'p0', 1, 1, 0, 100)).toMatchObject({ phase: 'category', round: { answers: {} } }); // before the question shows
    expect(tap(g, 'stranger', 0)).toBe(g);
    expect(tap(L.kick(g, 'p1'), 'p1', 0).round!.answers).toEqual({});
    const revealed = L.step(g, 5000);
    expect(L.answer(revealed, 'p0', g.at, 1, 0, 5000)).toBe(revealed);
    expect(L.tap(revealed, 'p0', g.at, 1, 0, 5000).refused).toBe(true);
  });

  it('reveals when every connected player in the game has answered, or at the deadline', () => {
    const g = room();
    const online = new Set(['p0', 'p1']); // p2's phone dropped: nobody waits for it
    expect(L.tick(tap(g, 'p0', 0), 4000, online).phase).toBe('answer');
    expect(L.tick(tap(tap(g, 'p0', 0), 'p1', 1), 4000, online).phase).toBe('reveal');
    expect(L.tick(g, 22_999, online).phase).toBe('answer');
    expect(L.tick(g, 23_000, online)).toMatchObject({ phase: 'reveal', deadline: 23_000 + L.REVEAL_MS });
  });

  it('scores a right answer 500 plus up to 500 for speed, and a wrong or missing one 0', () => {
    const start = L.CATEGORY_MS;
    let g = tap(room(4), 'p0', 0, start); // at once: full time left
    g = tap(g, 'p1', 0, start + 10_000); // half the time left
    g = tap(g, 'p2', 0, start + 20_000); // no time left
    g = tap(g, 'p3', 1, start); // wrong
    g = L.step(g, start + 20_000);
    expect(g.players.map((p) => p.score)).toEqual([1000, 750, 500, 0]);
    expect(g.round!.result).toEqual({ counts: [3, 1, 0, 0], gains: [{ pid: 'p0', points: 1000 }, { pid: 'p1', points: 750 }, { pid: 'p2', points: 500 }] });
    expect(L.points(true, 6_667, 20_000)).toBe(667);
  });

  it("drops the answer of a player removed or gone by the reveal", () => {
    let g = tap(tap(room(), 'p0', 0), 'p1', 0);
    g = L.step(L.kick(g, 'p1'), 5000);
    expect(g.round!.result!.counts).toEqual([1, 0, 0, 0]);
    expect(score(g, 'p1')).toBe(0);
  });

  it('lets a late joiner answer the question in play', () => {
    let g = room(2);
    g = (L.join(g, 'late', 'Late', all(g)) as { game: L.Game }).game;
    g = L.step(tap(g, 'late', 0), 5000);
    expect(g.round!.result!.gains.map((x) => x.pid)).toEqual(['late']);
  });

  it('asks the next question after the reveal and ends after the last', () => {
    let g = room(2, { count: 10 });
    g = L.tick(L.step(g, 4000), 4000 + L.REVEAL_MS, all(g));
    expect([g.phase, g.round!.n]).toEqual(['category', 2]);
    for (let n = 2; n < 10; n++) g = L.step(L.step(L.step(g, n), n), n);
    g = L.step(L.step(g, 10), 10);
    expect([g.phase, L.lastStep(g)]).toEqual(['reveal', true]);
    g = L.step(g, 11);
    expect([g.phase, g.results.length, view(g, 11).count]).toEqual(['over', 10, 10]);
  });

  it('ends when fewer than two players are left', () => {
    const g = L.leave(L.step(room(2), 5000), 'p1');
    expect(L.lastStep(g)).toBe(true);
    expect(L.step(g, 6000).phase).toBe('over');
  });

  it('seats as many players as the Games page says', () => {
    expect(GAMES.find((x) => x.id === 'trivia')!.players).toMatch(new RegExp(`^${L.MIN_PLAYERS}–${L.MAX_PLAYERS} players`));
  });

  it('stops the clock while paused, and a tap then scores the time left when it stopped', () => {
    const g = L.pause(room(2), 13_000);
    expect(L.tick(g, 1e9, all(g)).phase).toBe('answer');
    expect(L.step(tap(g, 'p0', 0, 50_000), 50_000).players[0].score).toBe(750);
    expect(L.resume(g, 100_000).deadline).toBe(110_000);
  });

  it('gives phones time to reconnect after a host reload before anyone counts as gone', () => {
    const g = L.afterReload(tap(room(2), 'p0', 0), 4000);
    expect(L.tick(g, 5000, new Set(['p0'])).phase).toBe('answer');
    expect(L.tick(g, 4000 + L.RECONNECT_MS, new Set(['p0'])).phase).toBe('reveal');
  });
});
