import { describe, expect, it } from 'vitest';
import { GAMES } from '../../app.config';
import * as L from './logic';
import { roomQuestions } from './pack';
import { ratherKey } from './rules';
import { view } from './view';

const questions = Array.from({ length: 25 }, (_, i) => `do thing ${i} or skip thing ${i}`);
const settings = (patch: Partial<L.Settings> = {}): L.Settings => ({ ...L.DEFAULT_SETTINGS, ...patch });

function lobby(n = 4, patch: Partial<L.Settings> = {}) {
  let g = L.newGame('g', 'BCDF', settings(patch));
  for (let i = 0; i < n; i++) g = (L.join(g, `p${i}`, `P${i}`, new Set()) as { game: L.Game }).game;
  return g;
}
const room = (n = 4, patch: Partial<L.Settings> = {}) => L.start(lobby(n, patch), questions, 0);
const all = (g: L.Game) => new Set(g.players.map((p) => p.pid));
const vote = (g: L.Game, pid: string, side: L.Side) => L.vote(g, pid, g.at, g.round!.n, side);
const score = (g: L.Game, pid: string) => g.players.find((p) => p.pid === pid)!.score;
/** Votes in order: `sides[i]` for player i (undefined: no vote). */
const votes = (g: L.Game, sides: (L.Side | undefined)[]) =>
  sides.reduce((acc, side, i) => side === undefined ? acc : vote(acc, `p${i}`, side), g);

describe('Would You Rather votes', () => {
  it('counts a vote only for the question in play, from a player in the game, before the reveal', () => {
    const g = room();
    expect(L.vote(g, 'p0', g.at + 1, 1, 0)).toBe(g); // another phase
    expect(L.vote(g, 'p0', g.at, 2, 0)).toBe(g); // another question
    expect(vote(g, 'stranger', 0)).toBe(g);
    expect(vote(L.kick(g, 'p1'), 'p1', 0).round!.votes).toEqual({});
    const revealed = L.step(g, 1);
    expect(L.vote(revealed, 'p0', g.at, 1, 0)).toBe(revealed);
    expect(vote(g, 'p0', 1).round!.votes).toEqual({ p0: 1 });
  });

  it('keeps the last tap', () => {
    const g = vote(vote(room(), 'p0', 0), 'p0', 1);
    expect(g.round!.votes.p0).toBe(1);
    expect(vote(g, 'p0', 1)).toBe(g);
  });

  it('reveals when every connected player in the game has voted, or at the deadline, never by itself with no limit', () => {
    const g = room();
    const online = new Set(['p0', 'p1', 'p2']); // p3's phone dropped: nobody waits for it
    expect(L.tick(votes(g, [0, 1]), 1, online).phase).toBe('vote');
    expect(L.tick(votes(g, [0, 1, 1]), 1, online).phase).toBe('reveal');
    expect(L.tick(g, 19_999, online).phase).toBe('vote');
    expect(L.tick(g, 20_000, online).phase).toBe('reveal');
    const none = room(4, { seconds: 0 });
    expect([none.deadline, L.tick(none, 1e9, online).phase]).toEqual([null, 'vote']);
    expect(L.step(none, 1).phase).toBe('reveal');
  });

  it('lets a late joiner vote on the question in play', () => {
    let g = room(3);
    g = (L.join(g, 'late', 'Late', all(g)) as { game: L.Game }).game;
    g = L.step(votes(vote(g, 'late', 1), [1, 0, 0]), 1);
    expect(g.round!.tally!.counts).toEqual([2, 2]);
  });
});

describe('Would You Rather points', () => {
  it('gives a point to each player on the bigger side, and none to the other side or a non-voter', () => {
    const g = L.step(votes(room(), [0, 0, 1]), 1);
    expect(g.round!.tally).toEqual({ counts: [2, 1], voters: [['p0', 'p1'], ['p2']], winner: 0 });
    expect(g.players.map((p) => p.score)).toEqual([1, 1, 0, 0]);
  });

  it('scores a unanimous vote, but not a tie or a question nobody voted on', () => {
    expect(L.step(votes(room(), [1, 1, 1, 1]), 1).players.map((p) => p.score)).toEqual([1, 1, 1, 1]);
    const tie = L.step(votes(room(), [0, 1, 0, 1]), 1);
    expect([tie.round!.tally!.winner, tie.players.map((p) => p.score)]).toEqual([null, [0, 0, 0, 0]]);
    const nobody = L.step(room(), 1);
    expect([nobody.round!.tally!.counts, nobody.round!.tally!.winner]).toEqual([[0, 0], null]);
  });

  it("drops the vote of a player removed or gone by the reveal", () => {
    let g = votes(room(), [0, 1, 1]);
    g = L.step(L.leave(L.kick(g, 'p2'), 'p1'), 1);
    expect(g.round!.tally).toEqual({ counts: [1, 0], voters: [['p0'], []], winner: 0 });
    expect(score(g, 'p0')).toBe(1);
  });
});

describe('Would You Rather game', () => {
  it('seats as many players as the Games page says', () => {
    expect(GAMES.find((g) => g.id === 'rather')!.players).toMatch(new RegExp(`^${L.MIN_PLAYERS}–${L.MAX_PLAYERS} players`));
  });

  it('asks the next question after the reveal and ends after the last', () => {
    let g = room(3, { count: 10 });
    expect([g.questions, g.round!.prompt]).toEqual([questions.slice(0, 10), questions[0]]);
    g = L.tick(L.step(g, 1), 1 + L.REVEAL_MS, all(g));
    expect([g.phase, g.round!.n, g.round!.prompt]).toEqual(['vote', 2, questions[1]]);
    for (let n = 2; n <= 10; n++) g = L.step(L.step(g, n), n);
    expect([g.phase, g.results.length]).toEqual(['over', 10]);
  });

  it("asks only the picks' questions, game after game, new ones first, then starts over with the rest", () => {
    const packs = [
      { id: 'mine', name: 'Mine', blurb: '', prompts: questions.slice(0, 12) },
      { id: 'other', name: 'Other', blurb: '', prompts: ['wink or nod', 'tea or coffee'] },
    ];
    const play = (g: L.Game) => {
      for (let n = 1; n <= g.questions.length; n++) g = L.step(L.step(g, n), n);
      return L.rematch(g, 'next', settings());
    };
    let g = lobby(3);
    const games: string[][] = [];
    for (let i = 0; i < 3; i++) {
      g = L.start(g, roomQuestions(packs, ['mine']), 0);
      games.push(g.questions);
      g = play(g);
    }
    expect(games.flat().every((q) => packs[0].prompts.includes(q))).toBe(true);
    expect(new Set([...games[0], ...games[1].slice(0, 2)]).size).toBe(12); // the second game asks the 2 left first
    expect(new Set(games[1]).size).toBe(10);
    expect(g.asked.length).toBeLessThanOrEqual(12);
  });

  it('reads the packs as they are at each start: an edited or deleted question is never asked from memory', () => {
    let g = room(3);
    for (let n = 1; n <= 10; n++) g = L.step(L.step(g, n), n);
    g = L.rematch(g, 'g2', settings());
    const edited = ['jump or dive', ...questions.slice(10, 12)];
    const second = L.start(g, edited, 0);
    expect(second.questions).toEqual(edited); // the rest of the old questions are gone from the pack
    expect(second.asked).toEqual(['jump or dive'].map(ratherKey));
  });

  it('asks swapped choices once a game, and only as many questions as the picks hold', () => {
    const g = L.start(lobby(3), ['fly or swim', 'swim or fly', 'nap or snack', 'tea or coffee', 'run or walk', 'sing or dance', 'read or write'], 0);
    expect(g.questions).toEqual(['fly or swim', 'nap or snack', 'tea or coffee', 'run or walk', 'sing or dance', 'read or write']);
  });

  it('ends when fewer than two players are left, says the step before is the last, and counts the questions asked', () => {
    let g = L.step(room(3), 1);
    expect(L.lastStep(g)).toBe(false);
    g = L.leave(L.kick(g, 'p1'), 'p2');
    expect(L.lastStep(g)).toBe(true);
    g = L.step(g, 2);
    expect([g.phase, view(g, 2).count]).toEqual(['over', 1]);
    let full = room(3);
    for (let n = 1; n < 10; n++) full = L.step(L.step(full, n), n);
    expect([L.lastStep(full), L.lastStep(L.step(full, 10))]).toEqual([false, true]);
  });

  it('tells a phone its tap did not count only when it did not: a late tap, never a repeated one', () => {
    const g = vote(room(), 'p0', 1);
    expect(L.tap(g, 'p0', g.at, 1, 1)).toEqual({ game: g, refused: false });
    expect(L.tap(g, 'p0', g.at, 1, 0).refused).toBe(false);
    const late = L.step(g, 1);
    expect(L.tap(late, 'p0', g.at, 1, 1)).toEqual({ game: late, refused: true });
    expect(L.tap(g, 'stranger', g.at, 1, 1).refused).toBe(true);
  });

  it('gives phones time to reconnect after a host reload before anyone counts as gone', () => {
    const g = L.afterReload(vote(room(), 'p0', 0), 1000);
    expect(L.tick(g, 2000, new Set(['p0'])).phase).toBe('vote');
    expect(L.tick(g, 1000 + L.RECONNECT_MS, new Set(['p0'])).phase).toBe('reveal');
  });

  it('stops the clock while paused', () => {
    const g = L.pause(room(), 5000);
    expect(L.tick(g, 1e9, all(g)).phase).toBe('vote');
    const resumed = L.resume(g, 100_000);
    expect(resumed.deadline).toBe(115_000);
  });
});
