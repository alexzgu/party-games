// A guess list follows its newest row only while the player is looking at it.
import { describe, expect, it } from 'vitest';
import { afterChange, atEnd } from './follow';

describe('the guess list', () => {
  it('counts as at its end when its last row shows, give or take rounding', () => {
    expect(atEnd(400, 600, 200)).toBe(true);
    expect(atEnd(397.5, 600, 200)).toBe(true);
    expect(atEnd(0, 150, 200)).toBe(true);
    expect(atEnd(300, 600, 200)).toBe(false);
  });

  it('stays at its end after a change when it was there, and stays put when scrolled up', () => {
    expect(afterChange(atEnd(400, 600, 200), 640)).toBe(640);
    expect(afterChange(atEnd(100, 600, 200), 640)).toBeNull();
  });
});
