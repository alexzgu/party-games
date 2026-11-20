import { describe, expect, it } from 'vitest';
import { BASELINE_MAX_DEG, DEFAULT_TILT, SteadyDetector, TiltDetector, type TiltThresholds } from './tilt';
import { UprightTracker, axisSignFromLookingAt, toScreen, uprightRotation, type Gravity } from './motion';

const G = 9.81;
/**
 * The three fixed sizes the detector had before calibration, with a gentle speed check (80°/s)
 * so these hand-made nods (26° in 250 ms is 104°/s) still count; the behaviour at each is unchanged.
 */
const GENTLE = 80;
const SIZE: Record<'small' | 'medium' | 'big', TiltThresholds> = {
  small: { down: 22, up: 26, rate: GENTLE },
  medium: { down: 32, up: 40, rate: GENTLE },
  big: { down: 40, up: 55, rate: GENTLE },
};
/** Spec-convention gravity for a phone sideways (right edge up) pitched `deg` screen-up. */
const pitched = (deg: number): Gravity => {
  const r = (deg * Math.PI) / 180;
  return [G * Math.cos(r), 0, G * Math.sin(r)];
};

describe('TiltDetector', () => {
  function feed(d: TiltDetector, samples: Gravity[], start = 0, step = 20) {
    return samples.map((g, i) => d.update(g, start + i * step)).filter(Boolean);
  }

  it('ignores the first tilt until the phone has rested at neutral', () => {
    const d = new TiltDetector(SIZE.big);
    expect(feed(d, [pitched(-70), pitched(-70)])).toEqual([]);
  });

  it('fires correct on tilt down and pass on tilt up, once per gesture', () => {
    const d = new TiltDetector(SIZE.big);
    const neutral = Array(12).fill(pitched(10));
    expect(feed(d, [...neutral, pitched(-45), pitched(-60), pitched(-80)])).toEqual(['correct']);
    expect(feed(d, [...neutral, pitched(60), pitched(70)], 1000)).toEqual(['pass']);
  });

  it('does not fire between the neutral band and the thresholds', () => {
    const d = new TiltDetector(SIZE.big);
    expect(feed(d, [...Array(12).fill(pitched(0)), pitched(-35), pitched(50)])).toEqual([]);
  });

  const rest = (deg: number, n = 12) => Array<Gravity>(n).fill(pitched(deg));

  it('scores a small nod at small sensitivity but not at big', () => {
    const nod = [...rest(0), pitched(-25), pitched(-10), ...rest(0), pitched(28)];
    expect(feed(new TiltDetector(SIZE.small), nod)).toEqual(['correct', 'pass']);
    expect(feed(new TiltDetector(SIZE.medium), nod)).toEqual([]);
    expect(feed(new TiltDetector(SIZE.big), nod)).toEqual([]);
  });

  it('measures nods from the resting pitch, not from vertical', () => {
    // Phone tipped back 15° on the forehead: a 25° nod either way lands at -10° and +40°.
    const d = new TiltDetector(SIZE.small, 15);
    expect(feed(d, [...rest(15), pitched(-10), ...rest(15), pitched(42)])).toEqual(['correct', 'pass']);
    // Measured from vertical, a brief rest at that pose (under STILL_MS) does not arm.
    const vertical = new TiltDetector(SIZE.small);
    expect(feed(vertical, [...rest(15), pitched(-10)])).toEqual([]);
  });

  it('clamps a bad resting pitch and treats a missing one as vertical', () => {
    const wild = new TiltDetector(SIZE.small, 80);
    const nan = new TiltDetector(SIZE.small, Number.NaN);
    expect(feed(wild, [...rest(BASELINE_MAX_DEG), pitched(BASELINE_MAX_DEG - 25)])).toEqual(['correct']);
    expect(feed(nan, [...rest(0), pitched(-25)])).toEqual(['correct']);
  });

  it('does not score twice on a wobble around the threshold', () => {
    const d = new TiltDetector(SIZE.small);
    const wobble = [pitched(-24), pitched(-18), pitched(-24), pitched(-12), pitched(-23), pitched(-20), pitched(-25)];
    expect(feed(d, [...rest(0), ...wobble, ...wobble])).toEqual(['correct']);
  });

  it('needs a held return to rest between scores', () => {
    const d = new TiltDetector(SIZE.small);
    // Swinging back up through rest after a got-it is not a pass.
    expect(feed(d, [...rest(0), pitched(-25), pitched(-5), pitched(5), pitched(30), pitched(35)])).toEqual(['correct']);
    // Back at rest too briefly (under the hold time): still no score.
    expect(feed(d, [...rest(0, 3), pitched(-25)], 1000)).toEqual([]);
    // Held at rest long enough: the next nod counts.
    expect(feed(d, [...rest(0), pitched(-25)], 2000)).toEqual(['correct']);
  });
});

describe('TiltDetector re-arms on a still pose', () => {
  function feed(d: TiltDetector, samples: Gravity[], start = 0, step = 20) {
    return samples.map((g, i) => d.update(g, start + i * step)).filter(Boolean);
  }
  const rest = (deg: number, n = 20) => Array<Gravity>(n).fill(pitched(deg));

  it('arms and re-bases when no resting pitch was caught (tap start, reload)', () => {
    const d = new TiltDetector(SIZE.small); // baseline 0, but the phone rests tipped back 15°
    expect(feed(d, [...rest(15), pitched(-10)])).toEqual(['correct']);
  });

  it('keeps working when the player leans back mid-round', () => {
    const d = new TiltDetector(SIZE.small);
    expect(feed(d, [...rest(0), pitched(-25)])).toEqual(['correct']);
    // Settles 12° further back than before, outside the narrow band: re-arms there.
    expect(feed(d, [...rest(12), pitched(-12)], 1000)).toEqual(['correct']);
  });

  it('does not re-arm while still held on the side that just scored', () => {
    const d = new TiltDetector(SIZE.small);
    expect(feed(d, [...rest(0), pitched(-25), ...rest(-20), pitched(10)])).toEqual(['correct']);
  });
});

describe('TiltDetector follows the last two seconds', () => {
  const at = (samples: number[], start: number, step = 20) => samples.map((deg, i) => ({ g: pitched(deg), t: start + i * step }));
  function run(d: TiltDetector, seq: { g: Gravity; t: number }[]) {
    return seq.map(({ g, t }) => d.update(g, t)).filter(Boolean);
  }
  const hold = (deg: number, ms: number) => Array<number>(Math.round(ms / 20)).fill(deg);
  const ramp = (from: number, to: number, ms: number) => {
    const n = Math.round(ms / 20);
    return Array.from({ length: n }, (_, i) => from + ((to - from) * (i + 1)) / n);
  };

  it('absorbs a slow drift, then scores a nod from the new pose', () => {
    const d = new TiltDetector(SIZE.small);
    // Leans back 18° over 4 s (4.5°/s): no score. A quick 25° nod from there counts.
    const seq = [...hold(0, 600), ...ramp(0, 18, 4000), ...hold(18, 1000), ...ramp(18, -7, 200)];
    expect(run(d, at(seq, 0))).toEqual(['correct']);
  });

  it('scores a quick nod but not the same angle reached slowly', () => {
    expect(run(new TiltDetector(SIZE.small), at([...hold(0, 1000), ...ramp(0, -26, 250)], 0))).toEqual(['correct']);
    expect(run(new TiltDetector(SIZE.small), at([...hold(0, 1000), ...ramp(0, -26, 5000)], 0))).toEqual([]);
  });

  it('never re-fires or fires the other way while a tilt is held and released', () => {
    const d = new TiltDetector(SIZE.small);
    const seq = [...hold(0, 1000), ...ramp(0, -30, 200), ...hold(-30, 3000), ...ramp(-30, 0, 300), ...hold(0, 1000)];
    expect(run(d, at(seq, 0))).toEqual(['correct']);
    // And the next nod still counts.
    expect(run(d, at([...ramp(0, 28, 200)], 6000))).toEqual(['pass']);
  });
});

describe('TiltDetector: quick tilts in a row', () => {
  /** 60 Hz pitch through keyframes [ms, deg], eased like a real nod, with its rate (°/s). */
  function nods(keys: [number, number][]) {
    const out: { t: number; p: number; r: number }[] = [];
    for (let i = 1; i < keys.length; i++) {
      const [t0, p0] = keys[i - 1];
      const [t1, p1] = keys[i];
      for (let t = t0; t < t1; t += 1000 / 60) {
        const u = (t - t0) / (t1 - t0);
        out.push({ t, p: p0 + ((p1 - p0) * (1 - Math.cos(Math.PI * u))) / 2, r: ((p1 - p0) * Math.PI * Math.sin(Math.PI * u)) / 2 / ((t1 - t0) / 1000) });
      }
    }
    return out;
  }
  const run = (keys: [number, number][], th = DEFAULT_TILT, base = 0) => {
    const d = new TiltDetector(th, base);
    return nods(keys).map((s) => d.step(s.p, s.r, s.t)).filter(Boolean);
  };
  /** Rest, then each [peak, out ms, back ms, ms at rest]: a tilt out and back. */
  const series = (moves: [number, number, number, number][]) => {
    const keys: [number, number][] = [[0, 0], [500, 0]];
    for (const [peak, out, back, rest] of moves) {
      const t = keys[keys.length - 1][0];
      keys.push([t + out, peak], [t + out + back, 0]);
      if (rest) keys.push([t + out + back + rest, 0]);
    }
    return keys;
  };

  it('scores eight downs barely touching rest in between', () => {
    expect(run(series(Array(8).fill([-60, 200, 233, 67])))).toEqual(Array(8).fill('correct'));
    expect(run(series(Array(8).fill([-60, 200, 200, 0])))).toEqual(Array(8).fill('correct'));
  });

  it('scores eight ups, and alternating tilts, at the same pace', () => {
    expect(run(series(Array(8).fill([55, 200, 200, 0])))).toEqual(Array(8).fill('pass'));
    const alt = Array.from({ length: 8 }, (_, i) => [i % 2 ? 60 : -60, 250, 283, 67] as [number, number, number, number]);
    expect(run(series(alt))).toEqual(Array.from({ length: 8 }, (_, i) => (i % 2 ? 'pass' : 'correct')));
  });

  it('does not count the rebound past rest after a tilt as the other way', () => {
    expect(run([[0, 0], [500, 0], [700, -60], [900, 22], [1000, 0], [1200, -60], [1400, 0], [1900, 0]])).toEqual(['correct', 'correct']);
    expect(run([[0, 0], [500, 0], [700, 55], [900, -24], [1000, 0], [1200, 55], [1400, 0], [1900, 0]])).toEqual(['pass', 'pass']);
  });

  it('does not score the release of a tilt held just short of the angle', () => {
    expect(run([[0, 0], [1000, 0], [1120, -24], [3620, -24], [3740, 0], [4500, 0]])).toEqual([]);
  });

  it('does not lend the speed of the way back to a slow lean after it', () => {
    expect(run([[0, 0], [1000, 0], [1200, -60], [4200, -60], [4350, 0], [4483, 0], [4883, 21], [5500, 21]])).toEqual(['correct']);
  });

  it('scores from any resting pose the countdown accepts', () => {
    expect(run([[0, 34], [1000, 34], [1200, -15], [1500, 34], [3000, 34], [3200, -15], [3500, 34], [4000, 34]], DEFAULT_TILT, 34)).toEqual(['correct', 'correct']);
  });

  it('measures the way back from the deepest point of the tilt that scored', () => {
    const d = new TiltDetector(DEFAULT_TILT);
    const events = [d.step(0, 0, 0), d.step(0, 0, 200), d.step(-60, -600, 300)];
    for (let t = 400; t <= 800; t += 16) events.push(d.step(-20, t === 400 ? 400 : 0, t));
    events.push(d.step(-35, -400, 850), d.step(-50, -300, 900));
    expect(events.filter(Boolean)).toEqual(['correct', 'correct']);
  });
});

describe('SteadyDetector', () => {
  it('fires after a sideways, near-vertical hold and restarts on wobble', () => {
    const d = new SteadyDetector();
    expect(d.update(pitched(10), 0)).toBe(false);
    expect(d.update(pitched(12), 400)).toBe(false);
    expect(d.update(pitched(40), 500)).toBe(false); // too far from vertical: restart
    expect(d.update(pitched(10), 600)).toBe(false);
    expect(d.update(pitched(11), 1300)).toBe(true);
  });

  it('reports the mean pitch over the steady hold as the resting pose', () => {
    const d = new SteadyDetector();
    expect(d.baseline()).toBeNull();
    d.update(pitched(30), 0); // first hold, then a wobble restarts it
    d.update(pitched(14), 100);
    d.update(pitched(18), 200);
    expect(d.update(pitched(16), 900)).toBe(true);
    expect(d.baseline()).toBeCloseTo(16, 5);
    d.reset();
    expect(d.baseline()).toBeNull();
  });

  it('does not fire for a phone held upright in portrait', () => {
    const d = new SteadyDetector();
    expect(d.update([0, G, 1], 0) || d.update([0, G, 1], 2000)).toBe(false);
  });
});

describe('upright rotation', () => {
  // DeviceMotion spec: held upright in portrait, accelerationIncludingGravity.y ≈ +9.8.
  it('needs no rotation for a portrait phone upright in a portrait page', () => {
    expect(uprightRotation([0, G, 0])).toBe(0);
    expect(uprightRotation([0, -G, 0])).toBe(180);
  });

  it('turns content clockwise when the right edge is up and the page stays portrait', () => {
    expect(uprightRotation([G, 0, 0])).toBe(90);
    expect(uprightRotation([-G, 0, 0])).toBe(-90);
  });

  it('needs no rotation when the page already turned with the phone', () => {
    // Phone turned counter-clockwise (top to the left): right edge up, page angle 90.
    expect(uprightRotation([G, 0, 0], 90)).toBe(0);
    // Turned clockwise: left edge up, page angle 270.
    expect(uprightRotation([-G, 0, 0], 270)).toBe(0);
    // Landscape page locked one way, phone held the other way: upside down.
    expect(uprightRotation([-G, 0, 0], 90)).toBe(180);
  });

  it('maps device gravity into the page frame', () => {
    expect(toScreen([G, 0, 1], 90)).toEqual([0, G, 1]);
    expect(toScreen([0, G, 1], 90)).toEqual([-G, 0, 1]);
  });

  it('keeps the edge while tilting and switches only after a steady new hold', () => {
    const t = new UprightTracker(90);
    expect(t.update([2, 0, -G], 0)).toBe(90); // face down: ignored
    expect(t.update([-G, 0, 1], 100)).toBe(90);
    expect(t.update([-G, 0, 1], 700)).toBe(270);
  });
});

describe('axis sign at Start', () => {
  it('keeps spec-convention readings, flips inverted ones, and abstains near zero', () => {
    expect(axisSignFromLookingAt([0, 6, 7])).toBe(1); // looking down at a portrait phone
    expect(axisSignFromLookingAt([0, -6, -7])).toBe(-1); // same pose, inverted axes
    expect(axisSignFromLookingAt([0, -G, -0.5])).toBe(-1); // held vertical, inverted
    expect(axisSignFromLookingAt([6, 0, 7], 90)).toBe(1); // landscape page
    expect(axisSignFromLookingAt([G, 0, 0.5])).toBeNull(); // sideways on a forehead: no idea
    expect(axisSignFromLookingAt(null)).toBeNull();
  });
});
