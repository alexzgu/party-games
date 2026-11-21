import { expect, it } from 'vitest';
import { rulesSummary } from './rulesSummary';

it('says the turn length, the end and what a skip costs', () => {
  expect(rulesSummary({ seconds: 60, mode: 'score', goal: 30, rounds: 3, skipCost: false })).toBe('60 s turns · first to 30 points · skips are free');
  expect(rulesSummary({ seconds: 45, mode: 'rounds', goal: 30, rounds: 1, skipCost: true })).toBe('45 s turns · 1 round · skips cost a point');
});
