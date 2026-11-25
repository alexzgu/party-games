// The fixed Draw & guess screens used to check the layout: &feed=<n> sets how many guesses show.
import { describe, expect, it } from 'vitest';
import { demo, demoGuesses } from './demo';

describe('Sketchy demo screens', () => {
  it('show the usual four guesses, or as many as asked for', () => {
    expect(demo('guess', true).feed).toHaveLength(4);
    for (const n of [0, 3, 20]) {
      expect(demo('drawing', true, n).feed, `drawer, ${n}`).toHaveLength(n);
      expect(demo('guess', true, n).feed, `guesser, ${n}`).toHaveLength(n);
    }
  });
});

describe('Sketchy demo addresses', () => {
  it('read &feed as a whole number of guesses, at most 200, and ignore anything else', () => {
    expect(demoGuesses('20')).toBe(20);
    expect(demoGuesses('0')).toBe(0);
    expect(demoGuesses('5000')).toBe(200);
    for (const bad of [null, '', '-3', '2.5', 'ten', '1e3']) expect(demoGuesses(bad), String(bad)).toBeNull();
  });
});
