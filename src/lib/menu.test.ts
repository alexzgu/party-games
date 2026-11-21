import { describe, expect, it } from 'vitest';
import { menuMove, opensUp } from './menu';

describe('menu keys', () => {
  it('moves with the arrows, wrapping, and jumps with Home and End', () => {
    expect(menuMove('ArrowDown', 0, 3)).toBe(1);
    expect(menuMove('ArrowDown', 2, 3)).toBe(0);
    expect(menuMove('ArrowUp', 0, 3)).toBe(2);
    expect(menuMove('Home', 2, 3)).toBe(0);
    expect(menuMove('End', 0, 3)).toBe(2);
  });

  it('starts at the first or last item when none has focus, and ignores other keys', () => {
    expect(menuMove('ArrowDown', -1, 3)).toBe(0);
    expect(menuMove('ArrowUp', -1, 3)).toBe(2);
    expect(menuMove('Enter', 1, 3)).toBeNull();
    expect(menuMove('ArrowDown', -1, 0)).toBeNull();
  });
});

describe('menu direction', () => {
  it('opens up when it fits above, else toward the larger room', () => {
    expect(opensUp(200, 50, 150)).toBe(true);
    expect(opensUp(100, 400, 150)).toBe(false);
    expect(opensUp(100, 80, 150)).toBe(true);
  });
});
