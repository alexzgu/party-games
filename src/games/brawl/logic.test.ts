import { describe, expect, it } from 'vitest';
import * as L from './logic';
import { artIds, view } from './view';

const ring = ['a', 'b', 'c'];
const at = 1000;
const seats = (pids = ring) => new Set(pids);
const players = ring.map((pid) => ({ pid, name: pid.toUpperCase(), score: 0 }));
const titles = Array.from({ length: 24 }, (_, i) => `Secret title ${i}`);
const start = (round = 1) => L.startRound({
  ...L.newGame('room', 'BCDF', L.DEFAULT_SETTINGS), players, titles, round: round - 1,
}, ring, at);
const next = (g: L.Game) => L.step(g, at, () => ring);
const submit = (g: L.Game, pid: string, name = 'Fighter') => L.submit(g, pid, g.at, name);
const all = (g: L.Game) => ring.reduce((game, pid) => submit(game, pid), g);
const voteFor = (g: L.Game, side: L.Side) => L.vote(g, 'c', g.at, side);

describe('Doodle Brawl game', () => {
  it('assigns a ring with one challenge each, without leaking another title', () => {
    const draw = submit(start(), 'a', 'Rook');
    expect(L.task(draw, 'a')?.title).toBe(titles[0]);
    expect(view(draw, at, 'b').title).toBe(titles[1]);
    const challenge = next(draw);
    expect(challenge.bouts.map((b) => b.artists)).toEqual([['a', 'b'], ['b', 'c'], ['c', 'a']]);
    const v = view(challenge, at, 'b');
    expect(v.draw?.opponent).toEqual({ name: 'Rook', id: L.task(draw, 'a')?.id });
    expect(artIds(v)).toEqual([v.draw?.opponent?.id]);
    expect(JSON.stringify(v)).not.toContain(titles[0]);
    const title = view(next(challenge), at);
    expect(title.title).toBe(titles[0]);
    expect(title.cards).toBeUndefined();
  });

  it('does not overwrite a submission or accept one from a previous phase', () => {
    const g = submit(start(), 'a', '  ');
    expect(L.task(g, 'a')?.fighter?.name).toBe('Nameless');
    expect(submit(g, 'a', 'New')).toBe(g);
    const challenge = next(g);
    expect(L.submit(challenge, 'a', g.at, 'Old')).toBe(challenge);
    expect(L.task(challenge, 'a')?.id).not.toBe(L.task(g, 'a')?.id);
  });

  it('scores shares, ties, no votes and walkovers', () => {
    expect(L.payout(1000, [2, 1], [true, true])).toEqual([667, 366]);
    expect(L.payout(1000, [1, 1], [true, true])).toEqual([500, 550]);
    expect(L.payout(2000, [0, 0], [true, true])).toEqual([1000, 1100]);
    expect(L.payout(1000, [0, 0], [false, true])).toEqual([0, 1000]);
    expect(L.payout(1000, [0, 0], [true, false])).toEqual([1000, 0]);
    expect(L.payout(1000, [0, 0], [false, false])).toEqual([0, 0]);
  });

  it('skips both-blank bouts and settles walkovers without a vote', () => {
    const g = next(next(start()));
    expect(g.phase).toBe('scores');
    expect(g.results).toEqual([]);
    const walkover = next(next(next(submit(start(), 'a'))));
    expect(walkover.phase).toBe('payout');
    expect(walkover.results[0]).toMatchObject({ winner: 0, points: [1000, 0] });
  });

  it('lets late joiners vote, rejects artists and repeat votes, and keeps disconnected seats', () => {
    const g = next(next(all(next(all(start())))));
    const joined = L.join(g, 'late', 'Late', seats());
    expect(joined.game).toBeDefined();
    const withLate = joined.game!;
    expect(L.vote(withLate, 'a', g.at, 1)).toBe(withLate);
    const voted = L.vote(withLate, 'late', g.at, 1);
    expect(L.vote(voted, 'late', g.at, 0)).toBe(voted);
    const end = L.tick(voted, at + 10, seats(['a', 'b', 'late']), () => ring);
    expect(end.results[0]).toMatchObject({ winner: 1, votes: [0, 1], points: [0, 1100] });
    expect(end.players.map((p) => p.pid)).toEqual([...ring, 'late']);
  });

  it('runs both rounds, consumes new titles, and pays the keeper only when they win', () => {
    let g = next(all(next(all(start()))));
    for (let i = 0; i < ring.length; i++) g = next(next(next(g)));
    expect(g.phase).toBe('scores');
    const earlier = g.shown.a[0];
    g = next(g);
    expect(g.round).toBe(2);
    expect(g.bouts.flatMap((b) => [b.title, b.surprise])).toEqual(titles.slice(3, 9));
    g = next(next(all(next(all(g)))));
    g = next(next(voteFor(g, 0)));
    expect(g.phase).toBe('tag');
    expect(L.tagOptions(g, 'a')).toContainEqual(earlier);
    expect(L.tag(g, 'b', g.at, earlier.id)).toBe(g);
    const swapped = next(L.tag(g, 'a', g.at, earlier.id));
    expect(view(swapped, at).cards?.[0]).toEqual(earlier);
    expect(next(voteFor(swapped, 0)).results.at(-1)?.points).toEqual([2000, 0]);
    expect(next(voteFor(next(g), 0)).results.at(-1)?.points).toEqual([2500, 0]);
    expect(next(next(next(g))).phase).toBe('title');
  });

  it('allows drawings sent at the buzzer to arrive before the pass closes', () => {
    const g = start();
    const deadline = g.deadline!;
    expect(L.left(g, deadline)).toBe(0);
    expect(L.tick(g, deadline, seats(), () => ring)).toBe(g);
    const completed = submit(g, 'a', '');
    expect(L.task(completed, 'a')?.fighter?.name).toBe('Nameless');
    expect(L.tick(completed, deadline + L.DRAW_DELIVERY_MS, seats(), () => ring).phase).toBe('challenge');
  });

  it('freezes the clock, gives expired saves time to reconnect, and preserves draft time for offline artists', () => {
    const g = start();
    const paused = L.pause(g, at + 1000);
    expect(L.left(paused, at + 5000)).toBe(89000);
    expect(L.tick(paused, at + 90000, seats(), () => ring)).toBe(paused);
    expect(L.left(L.resume(paused, at + 5000), at + 5000)).toBe(89000);
    expect(L.left(L.afterReload(g, at + 90000), at + 90000)).toBe(12000);
    const two = submit(submit(g, 'a'), 'b');
    expect(L.tick(two, at + 10, seats(), () => ring)).toBe(two);
    expect(L.tick(two, at + 10, seats(['a', 'b']), () => ring).phase).toBe('challenge');
  });

  it('lets a player who left come back, keeps the removed out, and stops waiting for a leaver', () => {
    const g = submit(submit(start(), 'a'), 'b');
    const gone = L.leave(g, 'c');
    expect(L.tick(g, at + 10, seats(), () => ring)).toBe(g);
    expect(L.tick(gone, at + 10, seats(), () => ring).phase).toBe('challenge');
    expect(L.join(gone, 'c', 'C', seats()).pid).toBe('c');
    expect(L.active((L.join(gone, 'c', 'C', seats()) as { game: L.Game }).game)).toHaveLength(3);
    expect(L.join(L.kick(gone, 'c'), 'c', 'C', seats()).error).toMatch(/removed/);
    const lobby = { ...L.newGame('room', 'BCDF', L.DEFAULT_SETTINGS), players };
    const again = L.rematch(L.kick(gone, 'b'), 'next');
    expect(L.join(again, 'b', 'B', seats()).error).toMatch(/removed/);
    expect((L.join(again, 'c', 'C', seats()) as { game: L.Game }).game.players.map((p) => p.pid)).toEqual(['a', 'c']);
    expect(L.leave(lobby, 'c').players.map((p) => p.pid)).toEqual(['a', 'b']);
  });

  it("deals round two from the room's own titles, reusing earlier ones without repeats or an artist's own where it can", () => {
    const eight = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const lobby = { ...L.newGame('room', 'BCDF', L.DEFAULT_SETTINGS), players: eight.map((pid) => ({ pid, name: pid, score: 0 })) };
    const one = L.startRound({ ...lobby, titles: Array.from({ length: 10 }, (_, i) => `t${i}`) }, eight, at);
    const two = L.startRound({ ...one, phase: 'scores' }, ['a', 'b', 'c', 'd'], at);
    const dealt = two.bouts.flatMap((b) => [b.title, b.surprise]);
    expect(dealt.slice(0, 2)).toEqual(['t8', 't9']);
    expect(new Set(dealt).size).toBe(8);
    for (const b of two.bouts) {
      const theirs = one.bouts.filter((x) => x.artists.some((pid) => b.artists.includes(pid))).map((x) => x.title);
      expect(theirs).not.toContain(b.title);
      expect(theirs).not.toContain(b.surprise);
    }
    // Too few titles for the bouts: every bout still gets one.
    const small = L.startRound({ ...lobby, titles: ['only'] }, ring, at);
    const smallTwo = L.startRound({ ...small, phase: 'scores' }, eight, at);
    expect(small.bouts.map((b) => b.title)).toEqual(['only', 'only', 'only']);
    expect(smallTwo.bouts.flatMap((b) => [b.title, b.surprise]).every((t) => t === 'only')).toBe(true);
  });
});
