import { describe, expect, it } from 'vitest';
import * as e from './board';

const lengths = (b: { categories: { clues: unknown[] }[] }) => b.categories.map((c) => c.clues.length);
const filled = () => {
  let b = e.blankBoard('Test', 3, 3);
  b.categories.forEach((c, ci) => c.clues.forEach((_, r) => (b = e.setClue(b, ci, r, { clue: `${ci}-${r} clue`, answer: `${ci}-${r}` }))));
  return b;
};

describe('board editor', () => {
  it('makes a blank board at the chosen size, within 1–8 × 1–10', () => {
    expect(lengths(e.blankBoard('x'))).toEqual([5, 5, 5, 5, 5]);
    expect(lengths(e.blankBoard('x', 20, 20))).toEqual(Array(8).fill(10));
    expect(lengths(e.blankBoard('x', 0, 0))).toEqual([1]);
    expect(e.emptyTiles(e.blankBoard('x', 2, 2))).toHaveLength(4);
  });
  it('adds and removes levels on every category at once', () => {
    let b = filled();
    b = e.addLevel(b);
    expect(lengths(b)).toEqual([4, 4, 4]);
    expect(e.levelContent(b, 3)).toBe(0);
    b = e.removeLevel(b, 0);
    expect(lengths(b)).toEqual([3, 3, 3]);
    expect(b.categories[1].clues[0].answer).toBe('1-1');
    let one = e.blankBoard('x', 2, 1);
    expect(e.removeLevel(one, 0)).toBe(one);
    one = e.blankBoard('x', 1, 10);
    expect(e.addLevel(one)).toBe(one);
  });
  it('adds a category as tall as the others; removes, renames and reorders them', () => {
    let b = e.addCategory(filled());
    expect(lengths(b)).toEqual([3, 3, 3, 3]);
    expect(b.categories[3].name).toBe('Category 4');
    b = e.moveCategory(b, 3, -1);
    expect(b.categories.map((c) => c.name)).toEqual(['Category 1', 'Category 2', 'Category 4', 'Category 3']);
    expect(e.moveCategory(b, 0, -1)).toBe(b);
    b = e.renameCategory(b, 0, 'Space');
    b = e.removeCategory(b, 1);
    expect(b.categories.map((c) => c.name)).toEqual(['Space', 'Category 4', 'Category 3']);
    const one = e.blankBoard('x', 1, 3);
    expect(e.removeCategory(one, 0)).toBe(one);
    const full = e.blankBoard('x', 8, 3);
    expect(e.addCategory(full)).toBe(full);
  });
  it('lists empty tiles and says which ones, with the game\'s values', () => {
    let b = e.setClue(filled(), 1, 2, { answer: ' ' });
    b = e.setClue(b, 0, 0, { clue: '', answer: '' });
    expect(e.emptyTiles(b)).toEqual([{ category: 0, level: 0, missing: 'both' }, { category: 1, level: 2, missing: 'answer' }]);
    expect(e.describeEmpty(b)).toBe('Category 1 100 and Category 2 300 (answer)');
    expect(e.describeEmpty(b, [200, 400, 600])).toBe('Category 1 200 and Category 2 600 (answer)');
    expect(e.describeEmpty(e.blankBoard('x', 2, 3))).toBe('Category 1 100, Category 1 200, Category 1 300 and 3 more');
  });
  it('checks size: 1–8 categories, 1–10 levels, all the same length', () => {
    expect(e.sizeProblem(filled())).toBe('');
    expect(e.sizeProblem({ categories: [] })).toMatch(/categories/);
    expect(e.sizeProblem(e.blankBoard('x', 2, 2) && { categories: [{ name: 'a', clues: [] }] })).toMatch(/levels/);
    const uneven = filled();
    expect(e.sizeProblem({ categories: [...uneven.categories, { name: 'x', clues: [{ clue: 'a', answer: 'b' }] }] })).toMatch(/different/);
  });
  it('tidies a board for saving: trims text and names blank categories', () => {
    const b = e.tidyBoard({ ...e.renameCategory(filled(), 1, '  '), name: '  ', blurb: ' b ', custom: true });
    expect(b.name).toBe('My pack');
    expect(b.categories[1].name).toBe('Category 2');
    expect('custom' in b).toBe(false);
  });
});
