import { describe, expect, it } from 'vitest';
import { doodle } from './doodle';
import { MAX_POINTS, readDrawing, pointCount } from './ink';
import { seeded } from './room/bots';
import { readToHost } from '../games/brawl/protocol';

describe('doodle', () => {
  it('is always a drawing both games accept', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const d = doodle(seeded(seed));
      expect(d.length).toBeGreaterThanOrEqual(3);
      expect(readDrawing(d)).toEqual(d);
      expect(pointCount(d)).toBeLessThan(MAX_POINTS);
      expect(readToHost({ t: 'draw', at: 1, name: 'Bot', d })).not.toBeNull();
    }
  });
});
