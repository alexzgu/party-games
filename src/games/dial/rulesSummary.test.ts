import { expect, it } from 'vitest';
import { rulesSummary } from './rulesSummary';

it('says the goal and whether steals are on', () => {
  expect(rulesSummary(10, true)).toBe('First to 10 points · steals on');
  expect(rulesSummary(15, false)).toBe('First to 15 points · no steals');
});
