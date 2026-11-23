import { describe, expect, it } from 'vitest';
import { placeTip, tipText } from './tooltip';

describe('tooltips', () => {
  it('sit over the button, under it at the top of the screen, and never leave the screen', () => {
    const tip = { width: 100, height: 30 }, screen = { width: 320, height: 640 };
    expect(placeTip({ left: 100, top: 200, width: 60, height: 40 }, tip, screen)).toEqual({ left: 80, top: 162 });
    expect(placeTip({ left: 0, top: 4, width: 40, height: 40 }, tip, screen)).toEqual({ left: 8, top: 52 });
    expect(placeTip({ left: 290, top: 610, width: 30, height: 30 }, tip, screen)).toEqual({ left: 212, top: 572 });
  });

  it('say the tip, else the name of a picture-only button', () => {
    expect(tipText({ tip: 'Copies the link', label: 'Share', shown: 'Share' })).toBe('Copies the link');
    expect(tipText({ label: 'Remove Sam', shown: ' ✕ ' })).toBe('Remove Sam');
    expect(tipText({ label: 'Return to room BCDF', shown: 'Return' })).toBe('');
    expect(tipText({ shown: 'Start' })).toBe('');
  });
});
