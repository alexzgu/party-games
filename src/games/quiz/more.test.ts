import { describe, expect, it, vi } from 'vitest';
import type { QuizBoard } from '../../lib/content';

const sent: { prompt: string }[] = [];
let reply: string[] = [];
vi.mock('../../lib/claude', async (real) => ({
  ...(await real<typeof import('../../lib/claude')>()),
  streamLines: async (o: { prompt: string; onLine: (l: string) => void }) => {
    sent.push(o);
    reply.forEach(o.onLine);
  },
}));

const { addClues, buildMorePrompt, moreClues, moreShapes } = await import('./more');

const board = (): QuizBoard => ({
  id: 'my-b', name: 'Space', blurb: 'Stars and planets',
  categories: [
    { name: 'Planets', clues: [{ clue: 'The Red Planet.', answer: 'Mars' }, { clue: 'The ringed giant.', answer: 'Saturn' }] },
    { name: 'Moons', clues: [{ clue: 'Earth has just one.', answer: 'The Moon' }, { clue: '', answer: '' }] },
  ],
});

async function ask(shape: 'category' | 'level', lines: string[]) {
  reply = lines;
  const got: { category: string; level: number; answer: string }[] = [];
  await moreClues(board(), shape, { count: 1, steer: 'harder', avoid: [], onItem: (k) => got.push(k) });
  return got.map((k) => `${k.category}/${k.level}/${k.answer}`);
}

describe('Big Board add more', () => {
  it('offers only the shapes the board has room for', () => {
    expect(moreShapes(board())).toEqual(['category', 'level']);
    const full = { ...board(), categories: Array.from({ length: 8 }, () => board().categories[0]) };
    expect(moreShapes(full)).toEqual(['level']);
  });

  it('asks with every clue on the board, the size of the slot and the steer', () => {
    const cat = buildMorePrompt(board(), 'category', 'harder');
    expect(cat).toContain('Planets | 1 | The Red Planet. | Mars');
    expect(cat).toContain('2 levels: 2 lines');
    expect(cat).toContain('Planets; Moons');
    expect(cat).toContain('The player asks for: harder');
    expect(buildMorePrompt(board(), 'level', '')).toContain('level 3, harder than every clue');
  });

  it('a new category takes one new name, one clue per level, and nothing already on the board', async () => {
    expect(await ask('category', [
      'Planets | 1 | Closest to the Sun. | Mercury', // an existing category
      'Stars | 1 | Our own star. | The Sun',
      'Comets | 2 | A second new name. | Halley',
      'Stars | 2 | It names itself: Polaris is the pole star. | Polaris',
      'Stars | 2 | Red in Orion, and huge. | Mars', // answer already on the board
      'Stars | 2 | The brightest star in the night sky. | Sirius',
      'Stars | 3 | Past the board. | Vega',
    ])).toEqual(['Stars/1/The Sun', 'Stars/2/Sirius']);
  });

  it('a new level takes one clue per existing category, at the next level', async () => {
    expect(await ask('level', [
      'Planets | 3 | Spins on its side. | Uranus',
      'Planets | 3 | Has the Great Red Spot. | Jupiter', // second clue for Planets
      'Asteroids | 3 | Not a category here. | Ceres',
      'moons | 1 | The largest moon of Saturn. | Titan',
    ])).toEqual(['Planets/3/Uranus', 'Moons/3/Titan']);
  });

  it('adds the kept clues; a dropped one stays an empty tile', () => {
    const b = board();
    const cat = addClues(b, 'category', [{ category: 'Stars', level: 2, clue: 'Brightest at night.', answer: 'Sirius' }]);
    expect(cat.categories[2]).toEqual({ name: 'Stars', clues: [{ clue: '', answer: '' }, { clue: 'Brightest at night.', answer: 'Sirius' }] });
    const lvl = addClues(b, 'level', [{ category: 'Moons', level: 3, clue: 'Saturn’s largest.', answer: 'Titan' }]);
    expect(lvl.categories.map((c) => c.clues.length)).toEqual([3, 3]);
    expect(lvl.categories[1].clues[2]).toEqual({ clue: 'Saturn’s largest.', answer: 'Titan' });
    expect(addClues(b, 'level', [])).toBe(b);
  });
});
