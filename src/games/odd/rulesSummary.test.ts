import { expect, it } from 'vitest';
import { rulesSummary } from './rulesSummary';

it('says the rounds, the hint and who may start', () => {
  expect(rulesSummary(5, true, true)).toBe('5 rounds · hint on · odd one never starts');
  expect(rulesSummary(3, false, false)).toBe('3 rounds · no hint · anyone starts');
});
