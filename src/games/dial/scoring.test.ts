import { describe, expect, it } from 'vitest';
import { bandSegments, pointsFor, randomTarget, stealPoints } from './scoring';

describe('pointsFor', () => {
  it('scores each band up to and including its edge', () => {
    expect(pointsFor(50, 50)).toBe(4);
    expect(pointsFor(50, 52.5)).toBe(4);
    expect(pointsFor(50, 52.6)).toBe(3);
    expect(pointsFor(50, 42.5)).toBe(3);
    expect(pointsFor(50, 42.4)).toBe(2);
    expect(pointsFor(50, 62.5)).toBe(2);
    expect(pointsFor(50, 62.6)).toBe(0);
    expect(pointsFor(10, 100)).toBe(0);
  });
});

describe('randomTarget', () => {
  it('stays inside [4, 96]', () => {
    expect(randomTarget(() => 0)).toBe(4);
    expect(randomTarget(() => 0.999999)).toBe(96);
  });
});

describe('stealPoints', () => {
  it('gives 1 point only for the side the target is really on', () => {
    expect(stealPoints(30, 50, 'left')).toBe(1);
    expect(stealPoints(30, 50, 'right')).toBe(0);
    expect(stealPoints(70, 50, 'right')).toBe(1);
    expect(stealPoints(50, 50, 'left')).toBe(0);
    expect(stealPoints(30, 50, null)).toBe(0);
  });
});

describe('bandSegments', () => {
  it('draws five wedges 2-3-4-3-2, clipped at the dial edge', () => {
    expect(bandSegments(50).map((s) => s.points)).toEqual([2, 3, 4, 3, 2]);
    const edge = bandSegments(4);
    expect(edge[0]).toEqual({ from: 0, to: 1.5, points: 3 });
    expect(edge.every((s) => s.from >= 0 && s.to <= 100)).toBe(true);
  });
});
