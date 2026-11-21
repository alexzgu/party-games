import { describe, expect, it } from 'vitest';
import { settingsSummary } from './settingsSummary';

describe('settingsSummary', () => {
  it('says every setting in one line', () => {
    expect(settingsSummary(3, 75, 15, 'everyone')).toBe('3 rounds · 75 s to write · 15 s to vote · 3-vote final');
    expect(settingsSummary(2, 45, 30, 'duels')).toBe('2 rounds · 45 s to write · 30 s to vote · duel final');
  });
});
