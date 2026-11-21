import { describe, expect, it } from 'vitest';
import { edges, openAtStart, SHORT_SCREEN_PX } from './panel';

describe('openAtStart', () => {
  it('keeps the phone’s own choice on any screen', () => {
    expect(openAtStart(false, 900)).toBe(false);
    expect(openAtStart(true, 390)).toBe(true);
  });
  it('without one, shows the panel on a tall screen and hides it on a short one', () => {
    expect(openAtStart(null, SHORT_SCREEN_PX)).toBe(true);
    expect(openAtStart(null, SHORT_SCREEN_PX - 1)).toBe(false);
    expect(openAtStart('yes', 390)).toBe(false); // a stale shape counts as no choice
  });
  it('shows it whatever was chosen while the game needs changes there to start', () => {
    expect(openAtStart(false, 900, true)).toBe(true);
    expect(openAtStart(null, 390, true)).toBe(true);
  });
});

describe('edges', () => {
  it('says which way there is more to scroll', () => {
    expect(edges(0, 300, 100)).toEqual({ above: false, below: true });
    expect(edges(100, 300, 100)).toEqual({ above: true, below: true });
    expect(edges(200, 300, 100)).toEqual({ above: true, below: false });
  });
  it('ignores a pixel of rounding and content that fits', () => {
    expect(edges(0.5, 100, 100)).toEqual({ above: false, below: false });
    expect(edges(199.5, 300, 100)).toEqual({ above: true, below: false });
    expect(edges(0, 80, 100)).toEqual({ above: false, below: false });
  });
});
