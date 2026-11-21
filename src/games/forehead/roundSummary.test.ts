import { expect, it } from 'vitest';
import { roundSummary } from './roundSummary';

it('says the round length and the controls', () => {
  expect(roundSummary(60, 'tilt')).toBe('60 s rounds · tilt only');
  expect(roundSummary(120, 'both')).toBe('2 min rounds · tilt or tap');
});
