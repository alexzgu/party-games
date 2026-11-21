import { expect, it } from 'vitest';
import { pointsSummary } from './pointsSummary';

it('says the tile values and what a wrong answer costs', () => {
  expect(pointsSummary(5, false, true)).toBe('Tiles 100–500 · wrong answers lose points');
  expect(pointsSummary(5, true, false)).toBe('Tiles 200–1,000 · wrong answers cost nothing');
});
