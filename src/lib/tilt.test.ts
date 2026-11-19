import { describe, expect, it } from 'vitest';
import { BASELINE_MAX_DEG, SteadyDetector, TiltDetector } from './tilt';
import { UprightTracker, axisSignFromLookingAt, toScreen, uprightRotation, type Gravity } from './motion';

const G = 9.81;
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
    const d = new TiltDetector('big');
    expect(feed(d, [pitched(-70), pitched(-70)])).toEqual([]);
  });

  it('fires correct on tilt down and pass on tilt up, once per gesture', () => {
    const d = new TiltDetector('big');
    const neutral = Array(12).fill(pitched(10));
    expect(feed(d, [...neutral, pitched(-45), pitched(-60), pitched(-80)])).toEqual(['correct']);
    expect(feed(d, [...neutral, pitched(60), pitched(70)], 1000)).toEqual(['pass']);
  });

  it('does not fire between the neutral band and the thresholds', () => {
    const d = new TiltDetector('big');
    expect(feed(d, [...Array(12).fill(pitched(0)), pitched(-35), pitched(50)])).toEqual([]);
  });

  const rest = (deg: number, n = 12) => Array<Gravity>(n).fill(pitched(deg));

  it('scores a small nod at small sensitivity but not at big', () => {
    const nod = [...rest(0), pitched(-25), pitched(-10), ...rest(0), pitched(28)];
    expect(feed(new TiltDetector('small'), nod)).toEqual(['correct', 'pass']);
    expect(feed(new TiltDetector('medium'), nod)).toEqual([]);
    expect(feed(new TiltDetector('big'), nod)).toEqual([]);
  });

  it('measures nods from the resting pitch, not from vertical', () => {
    // Phone tipped back 15° on the forehead: a 25° nod either way lands at -10° and +40°.
    const d = new TiltDetector('small', 15);
    expect(feed(d, [...rest(15), pitched(-10), ...rest(15), pitched(42)])).toEqual(['correct', 'pass']);
    // Measured from vertical, the same resting pose would never arm.
    const vertical = new TiltDetector('small');
    expect(feed(vertical, [...rest(15), pitched(-10)])).toEqual([]);
  });

  it('clamps a bad resting pitch and treats a missing one as vertical', () => {
    const wild = new TiltDetector('small', 80);
    const nan = new TiltDetector('small', Number.NaN);
    expect(feed(wild, [...rest(BASELINE_MAX_DEG), pitched(BASELINE_MAX_DEG - 25)])).toEqual(['correct']);
    expect(feed(nan, [...rest(0), pitched(-25)])).toEqual(['correct']);
  });

  it('does not score twice on a wobble around the threshold', () => {
    const d = new TiltDetector('small');
    const wobble = [pitched(-24), pitched(-18), pitched(-24), pitched(-12), pitched(-23), pitched(-20), pitched(-25)];
    expect(feed(d, [...rest(0), ...wobble, ...wobble])).toEqual(['correct']);
  });

  it('needs a held return to rest between scores', () => {
    const d = new TiltDetector('small');
    // Swinging back up through rest after a got-it is not a pass.
    expect(feed(d, [...rest(0), pitched(-25), pitched(-5), pitched(5), pitched(30), pitched(35)])).toEqual(['correct']);
    // Back at rest too briefly (under the hold time): still no score.
    expect(feed(d, [...rest(0, 3), pitched(-25)], 1000)).toEqual([]);
    // Held at rest long enough: the next nod counts.
    expect(feed(d, [...rest(0), pitched(-25)], 2000)).toEqual(['correct']);
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
