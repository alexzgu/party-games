import { describe, expect, it } from 'vitest';
import { bandSegments, MIN_GAP, pointsFor, randomTarget, spreadTarget, stealPoints, TARGET_MAX, TARGET_MIN, ZONES } from './scoring';

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

describe('spreadTarget', () => {
  it('lands inside its part of the dial and inside [4, 96]', () => {
    const width = (TARGET_MAX - TARGET_MIN) / ZONES;
    for (let z = 0; z < ZONES; z++) {
      for (const r of [0, 0.5, 0.999999]) {
        const t = spreadTarget(z, null, () => r);
        expect(t).toBeGreaterThanOrEqual(TARGET_MIN + z * width - 0.05);
        expect(t).toBeLessThanOrEqual(TARGET_MIN + (z + 1) * width + 0.05);
      }
    }
    expect(spreadTarget(0, null, () => 0)).toBe(TARGET_MIN);
    expect(spreadTarget(ZONES - 1, null, () => 0.999999)).toBe(TARGET_MAX);
  });

  it('keeps away from the previous target when its part allows', () => {
    const rolls = [0.1, 0.2, 0.9];
    const t = spreadTarget(1, 24, () => rolls.shift() ?? 0.9);
    expect(Math.abs(t - 24)).toBeGreaterThanOrEqual(MIN_GAP);
  });
});
