// The fixed Draw & guess screens used to check the layout: &feed=<n> sets how many guesses show.
import { describe, expect, it } from 'vitest';
import { demo } from './demo';

describe('Sketchy demo screens', () => {
  it('show the usual four guesses, or as many as asked for', () => {
    expect(demo('guess', true).feed).toHaveLength(4);
    for (const n of [0, 3, 20]) {
      expect(demo('drawing', true, n).feed, `drawer, ${n}`).toHaveLength(n);
      expect(demo('guess', true, n).feed, `guesser, ${n}`).toHaveLength(n);
    }
  });
});
