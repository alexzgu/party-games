import { describe, expect, it } from 'vitest';
import { canFallBack, EFFORTS } from './wizard';

describe('server-side fallback', () => {
  it('is asked for only by models that have it (Haiku 5.5 has none)', () => {
    expect(canFallBack('claude-haiku-5-5')).toBe(false);
    expect(canFallBack('claude-sonnet-5-5')).toBe(true);
    expect(canFallBack('claude-opus-5-5')).toBe(true);
    expect(canFallBack('claude-unknown')).toBe(false);
    expect(EFFORTS).toHaveLength(3);
  });
});
