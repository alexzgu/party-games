import { expect, it } from 'vitest';
import { rulesSummary } from './rulesSummary';

it('says the card timer and the points goal', () => {
  expect(rulesSummary(30, 10)).toBe('30 s per card · first to 10 points');
  expect(rulesSummary(0, 5)).toBe('No timer · first to 5 points');
});
