import { expect, it } from 'vitest';
import { rulesSummary } from './rulesSummary';

it('says the clock, the target and how steals work', () => {
  expect(rulesSummary(5, 7, true, false)).toBe('5 s on the clock · 7 points wins · steals on');
  expect(rulesSummary(7, 10, true, true)).toBe('7 s on the clock · 10 points wins · a steal uses your turn');
  expect(rulesSummary(10, 3, false, true)).toBe('10 s on the clock · 3 points wins · no steals');
});
