import { describe, expect, it } from 'vitest';
import { beginRound, callSide, lockIn, newGame, nextTurn, redraw, rematch, restore, scoresBefore, showTeam, winnerOf, type Game } from './state';

const card = { left: 'Cold', right: 'Hot' };
const cfg = (steal = false) => ({ names: ['A', 'B'] as [string, string], goal: 10, steal, packIds: ['classic'] });

function playRound(g: Game, target: number, guess: number, side?: 'left' | 'right'): Game {
  let s = lockIn(showTeam(beginRound(g, card, target)), guess);
  if (side) s = callSide(s, side);
  return nextTurn(s);
}

describe('turns', () => {
  it('alternates the active team every round', () => {
    let g = newGame(cfg());
    expect(g.active).toBe(0);
    g = playRound(g, 50, 90);
    expect(g.active).toBe(1);
    expect(g.phase).toBe('handoff');
    g = playRound(g, 50, 90);
    expect(g.active).toBe(0);
  });

  it('scores the active team and, with steal on, the other team', () => {
    let g = lockIn(showTeam(beginRound(newGame(cfg(true)), card, 30)), 35);
    expect(g.phase).toBe('steal');
    g = callSide(g, 'left');
    expect(g.phase).toBe('reveal');
    expect(g.teams.map((t) => t.score)).toEqual([3, 1]);
    expect(scoresBefore(g)).toEqual([0, 0]);
  });
});

describe('phase guards', () => {
  it('ignores lock-in and steal calls outside their own step', () => {
    const reader = beginRound(newGame(cfg(true)), card, 30);
    expect(lockIn(reader, 30)).toBe(reader);
    expect(callSide(reader, 'left')).toBe(reader);
    const steal = lockIn(showTeam(reader), 30);
    expect(steal.phase).toBe('steal');
    expect(lockIn(steal, 50)).toBe(steal);
  });

  it('remembers every card dealt this game', () => {
    const g = redraw(beginRound(newGame(cfg()), card, 30), { left: 'Soft', right: 'Hard' });
    expect(g.played).toEqual(['cold|hot', 'soft|hard']);
  });
});

describe('winning', () => {
  it('ends the game when a team reaches the goal ahead', () => {
    let g = newGame(cfg());
    g.teams[0].score = 8;
    g = playRound(g, 50, 50);
    expect(g.phase).toBe('win');
    expect(g.winner).toBe(0);
  });

  it('plays on while the teams are tied at or above the goal', () => {
    expect(winnerOf([{ name: 'A', score: 10 }, { name: 'B', score: 10 }], 10)).toBeNull();
    expect(winnerOf([{ name: 'A', score: 10 }, { name: 'B', score: 11 }], 10)).toBe(1);
  });

  it('rematch resets scores and lets the other team start', () => {
    const g = rematch({ ...newGame(cfg()), winner: 0, phase: 'win' });
    expect(g.teams.map((t) => t.score)).toEqual([0, 0]);
    expect(g.active).toBe(1);
  });
});

describe('restore', () => {
  it('rejects stale or broken saves', () => {
    expect(restore(null)).toBeNull();
    expect(restore({ v: 0 })).toBeNull();
    expect(restore({ ...newGame(cfg()), phase: 'team', round: null })).toBeNull();
    expect(restore(newGame(cfg()))).not.toBeNull();
  });

  it('rejects saves with a missing or wrong-typed field', () => {
    const team = lockIn(showTeam(beginRound(newGame(cfg()), card, 30)), 35);
    const bad: Record<string, unknown>[] = [
      { packIds: undefined }, { packIds: [1] }, { active: 2 }, { goal: 'ten' }, { goal: NaN },
      { roundNo: null }, { played: undefined }, { teams: [{ name: 'A', score: '3' }, { name: 'B', score: 0 }] },
    ];
    for (const patch of bad) expect(restore({ ...team, ...patch })).toBeNull();
    expect(restore({ ...team, round: { ...team.round!, target: undefined } })).toBeNull();
    expect(restore({ ...team, round: { ...team.round!, guess: Infinity } })).toBeNull();
    expect(restore(team)).not.toBeNull();
  });
});
