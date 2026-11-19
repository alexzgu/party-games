import { describe, expect, it } from 'vitest';
import { beginRound, callSide, lockIn, newGame, nextTurn, restore, setClue, showTeam, type Game } from './state';
import { summarize } from './summary';

const card = { left: 'Cold', right: 'Hot' };

function round(g: Game, target: number, guess: number, clue = '', side?: 'left' | 'right'): Game {
  let s = lockIn(showTeam(setClue(beginRound(g, card, target), clue)), guess);
  if (side) s = callSide(s, side);
  return nextTurn(s);
}

describe('game summary', () => {
  it('logs every round and titles the winner first', () => {
    let g = newGame({ names: ['Birds', 'Owls'], goal: 5, steal: true, packIds: ['classic'] });
    g = round(g, 50, 50, 'Soup', 'left'); // Birds 4, steal wrong (needle on target)
    g = round(g, 30, 40, '', 'left'); // Owls 2, Birds steal +1
    expect(g.phase).toBe('win');
    const s = summarize(g, ['Classic']);
    expect(s.title).toBe('Birds beat Owls 5–2');
    expect(s.scores).toEqual([{ name: 'Birds', score: 5 }, { name: 'Owls', score: 2 }]);
    expect(s.packs).toEqual(['Classic']);
    expect(s.details).toEqual([
      '1. Birds · Cold ↔ Hot · “Soup” · 4 pts',
      '2. Owls · Cold ↔ Hot · 2 pts · Birds stole 1',
    ]);
  });

  it('resumes a game saved before the round log existed', () => {
    const { log: _, ...old } = newGame({ names: ['A', 'B'], goal: 10, steal: false, packIds: [] });
    expect(restore(JSON.parse(JSON.stringify(old)))?.log).toEqual([]);
  });
});
