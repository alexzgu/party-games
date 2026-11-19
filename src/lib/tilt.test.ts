import { describe, expect, it } from 'vitest';
import { SteadyDetector, TiltDetector } from './tilt';
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
    const d = new TiltDetector();
    expect(feed(d, [pitched(-70), pitched(-70)])).toEqual([]);
  });

  it('fires correct on tilt down and pass on tilt up, once per gesture', () => {
    const d = new TiltDetector();
    const neutral = Array(12).fill(pitched(10));
    expect(feed(d, [...neutral, pitched(-45), pitched(-60), pitched(-80)])).toEqual(['correct']);
    expect(feed(d, [...neutral, pitched(60), pitched(70)], 1000)).toEqual(['pass']);
  });

  it('does not fire between the neutral band and the thresholds', () => {
    const d = new TiltDetector();
    expect(feed(d, [...Array(12).fill(pitched(0)), pitched(-35), pitched(50)])).toEqual([]);
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
