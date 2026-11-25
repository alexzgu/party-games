import { describe, expect, it } from 'vitest';
import { fanLayout, MIN_SHOWN } from './fan';

describe('a hand of cards', () => {
  it('sits side by side when it fits', () => {
    expect(fanLayout(5, 328, 52)).toMatchObject({ perRow: 5, rows: 1, strip: 56 });
  });

  it('keeps 30 cards on a 360 px phone tappable: within the width, at least half of each card showing, in few rows', () => {
    const room = 360 - 2 * 16;
    for (const n of [7, 13, 25, 30]) {
      const f = fanLayout(n, room, 52);
      expect(f.width).toBeLessThanOrEqual(room);
      expect(f.strip).toBeGreaterThanOrEqual(52 * MIN_SHOWN);
      expect(f.perRow * f.rows).toBeGreaterThanOrEqual(n);
    }
    expect(fanLayout(30, room, 52).rows).toBeLessThanOrEqual(3);
  });

  it('lays out a hand before anything is measured: finite numbers, never NaN', () => {
    for (const [n, room, w] of [[5, 0, 0], [5, 0, 52], [5, 328, 0], [5, -10, -3], [0, 0, 0], [30, 20, 52]]) {
      const f = fanLayout(n, room, w);
      expect(Object.values(f).every(Number.isFinite), `${n} ${room} ${w}`).toBe(true);
      expect(f.perRow).toBeGreaterThan(0);
    }
  });
});
