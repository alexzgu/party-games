import { describe, expect, it } from 'vitest';
import {
  ANGLE_LIMITS, GestureCatcher, MIN_TILT, RATE_LIMITS, storedThresholds, thresholdsFrom, tooSmall, type Gesture,
} from './calibration';

/** Pitch samples at 60 Hz with the rate (°/s) that goes with them. */
type Sample = { pitch: number; rate: number };
const DT = 1000 / 60;

function hold(pitch: number, ms: number): Sample[] {
  return Array.from({ length: Math.round(ms / DT) }, () => ({ pitch, rate: 0 }));
}

function move(from: number, to: number, ms: number): Sample[] {
  const n = Math.round(ms / DT);
  const rate = ((to - from) / ms) * 1000;
  return Array.from({ length: n }, (_, i) => ({ pitch: from + ((to - from) * (i + 1)) / n, rate }));
}

function feed(samples: Sample[]): Gesture[] {
  const c = new GestureCatcher();
  const out: Gesture[] = [];
  samples.forEach((s, i) => {
    const g = c.update(s.pitch, s.rate, i * DT);
    if (g) out.push(g);
  });
  return out;
}

/** A tilt from rest to `deg` and back, held there for `heldMs`, then a rest. */
const tilt = (deg: number, heldMs = 300) => [...move(0, deg, 150), ...hold(deg, heldMs), ...move(deg, 0, 150), ...hold(0, 1000)];

describe('GestureCatcher', () => {
  it('catches a quick tilt each way', () => {
    const got = feed([...hold(0, 1000), ...tilt(-30), ...tilt(25)]);
    expect(got.map((g) => g.dir)).toEqual(['down', 'up']);
    expect(got[0].amp).toBeCloseTo(30, 0);
  });

  it('never counts the way back from a held tilt as a gesture', () => {
    const got = feed([...hold(0, 1000), ...tilt(-30, 3000)]);
    expect(got.map((g) => g.dir)).toEqual(['down']);
  });

  it('never counts the way back from a held wrong-way tilt either', () => {
    const got = feed([...hold(0, 1000), ...tilt(25, 3000)]);
    expect(got.map((g) => g.dir)).toEqual(['up']);
  });

  it('catches the next tilt once the phone is back and still', () => {
    const got = feed([...hold(0, 1000), ...tilt(-30, 3000), ...tilt(25, 3000)]);
    expect(got.map((g) => g.dir)).toEqual(['down', 'up']);
  });

  it('ignores a non-finite rate inside a tilt', () => {
    const samples = [...hold(0, 1000), ...tilt(-30)];
    samples[Math.round(1000 / DT) + 3] = { pitch: -15, rate: NaN };
    samples[Math.round(1000 / DT) + 4] = { pitch: -18, rate: Infinity };
    const [g] = feed(samples);
    expect(g.dir).toBe('down');
    expect(g.rate).toBeCloseTo(200, 0);
  });

  it('reports a tilt too small to ever score, so it is not kept', () => {
    const [small] = feed([...hold(0, 1000), ...tilt(-11)]);
    expect(small.dir).toBe('down');
    expect(tooSmall(small)).toBe(true);
    const [big] = feed([...hold(0, 1000), ...tilt(-13)]);
    expect(tooSmall(big)).toBe(false);
  });
});

describe('thresholdsFrom', () => {
  it('scores the smallest tilt calibration keeps', () => {
    expect(MIN_TILT).toBe(ANGLE_LIMITS[0]);
    for (let amp = MIN_TILT; amp <= 80; amp++) {
      const th = thresholdsFrom([{ dir: 'down', amp, rate: 200 }, { dir: 'up', amp, rate: 200 }]);
      expect(th.down).toBeLessThanOrEqual(amp);
      expect(th.up).toBeLessThanOrEqual(amp);
    }
  });
});

describe('storedThresholds', () => {
  it('keeps a sound stored calibration', () => {
    expect(storedThresholds({ down: 18, up: 15, rate: 100 })).toEqual({ down: 18, up: 15, rate: 100 });
  });

  it('clamps zero, negative and oversized values into the limits', () => {
    expect(storedThresholds({ down: 0, up: -5, rate: 0 })).toEqual({ down: ANGLE_LIMITS[0], up: ANGLE_LIMITS[0], rate: RATE_LIMITS[0] });
    expect(storedThresholds({ down: 90, up: 90, rate: 900 })).toEqual({ down: ANGLE_LIMITS[1], up: ANGLE_LIMITS[1], rate: RATE_LIMITS[1] });
  });

  it('treats a wrong shape or a non-finite field as not calibrated', () => {
    for (const x of [null, 5, 'x', [], {}, { down: 18, up: 15 }, { down: NaN, up: 15, rate: 100 }, { down: '18', up: 15, rate: 100 }, { down: 18, up: null, rate: 100 }]) {
      expect(storedThresholds(x)).toBeNull();
    }
  });
});
