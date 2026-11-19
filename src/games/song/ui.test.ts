import { describe, expect, it } from 'vitest';
import { stageMode } from './ui';

describe('stageMode', () => {
  it('shows the reveal video only while the player holds this round’s song', () => {
    expect(stageMode('reveal', 'songAAAAAAA', 'songAAAAAAA')).toBe('shown');
    expect(stageMode('reveal', 'songAAAAAAA', 'nextBBBBBBB')).toBe('over');
    expect(stageMode('reveal', 'songAAAAAAA', '')).toBe('over');
  });
  it('covers while guessing and parks it otherwise', () => {
    expect(stageMode('listen', 'songAAAAAAA', 'songAAAAAAA')).toBe('covered');
    expect(stageMode('scores', 'songAAAAAAA', 'nextBBBBBBB')).toBe('hidden');
    expect(stageMode('ready', 'songAAAAAAA', 'songAAAAAAA')).toBe('hidden');
  });
});
