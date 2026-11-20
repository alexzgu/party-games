import { describe, expect, it } from 'vitest';
import { PitchTracker, edgeOf, type MotionSample } from './pitch';
import { TiltDetector, DEFAULT_TILT, type TiltThresholds } from './tilt';
import { GestureCatcher, thresholdsFrom, ANGLE_LIMITS, RATE_LIMITS } from './calibration';
import recorded from './fixtures/tilt-recorded.json';
import speed from './fixtures/tilt-speed.json';

// Real recordings from the Tilt lab (Firefox on Android, phone on a forehead): eight quick tilts
// 1.7 s apart, and 38 s of talking, laughing, looking around and leaning back with no tilts.
type Part = { rows: number[][]; cues: { t: number; kind: string }[] };
const samples = (p: Part): MotionSample[] => p.rows.map((r) => ({
  t: r[0],
  g: [r[1] / 100, r[2] / 100, r[3] / 100],
  lin: [r[4] / 100, r[5] / 100, r[6] / 100],
  rot: [r[7] / 10, r[8] / 10, r[9] / 10],
}));
const fast = recorded.fast as Part;
const noise = recorded.noise as Part;
const XYZ = { map: 'xyz', sign: 1 } as const;

function play(p: Part, th: TiltThresholds = DEFAULT_TILT, tracker = new PitchTracker(XYZ)) {
  const d = new TiltDetector(th);
  const events: string[] = [];
  for (const s of samples(p)) {
    tracker.update(s);
    const e = d.step(tracker.pitch, tracker.rate, s.t);
    if (e) events.push(e);
  }
  return events;
}
const cued = (p: Part) => p.cues.filter((c) => c.kind === 'down' || c.kind === 'up').map((c) => (c.kind === 'down' ? 'correct' : 'pass'));

describe('recorded quick tilts', () => {
  it('scores each one the way it was asked, once', () => {
    expect(play(fast)).toEqual(cued(fast));
  });

  it('raw gravity alone scores them backwards: the shove at the start of a nod', () => {
    const d = new TiltDetector(DEFAULT_TILT);
    const events = samples(fast).map((s) => d.update(s.g, s.t)).filter(Boolean);
    expect(events.filter((e, i) => e !== cued(fast)[i]).length).toBeGreaterThan(cued(fast).length / 2);
  });

  it('learns this browser\'s gyroscope layout from the tilts', () => {
    const tracker = new PitchTracker();
    for (const s of samples(fast)) tracker.update(s);
    expect(tracker.layout).toEqual(XYZ);
  });

  it('still gets most of them right with no gyroscope', () => {
    const events = play({ ...fast, rows: fast.rows.map((r) => [...r.slice(0, 7), NaN, NaN, NaN]) });
    const right = events.filter((e, i) => e === cued(fast)[i]).length;
    expect(right).toBeGreaterThanOrEqual(6);
  });
});

// A recorded speed run (Chrome on Android): alternating tilts 0.7 s apart, where a wind-up
// (the head lifting ~20° before nodding down) once scored as a pass; then as many downs, and then
// ups, as fast as possible, where the rest reference used to sink and lose every up.
describe('recorded speed run', () => {
  const after = (p: Part, kind: string, ms: number) => p.cues.find((c) => c.kind === kind)!.t + ms;
  function events(p: Part) {
    const tracker = new PitchTracker(XYZ);
    const d = new TiltDetector(DEFAULT_TILT);
    const out: { t: number; e: string }[] = [];
    for (const s of samples(p)) {
      tracker.update(s);
      const e = d.step(tracker.pitch, tracker.rate, s.t);
      if (e) out.push({ t: s.t, e });
    }
    return out;
  }

  it('scores alternating tilts as they alternate, never the same way twice in a row', () => {
    const got = events(speed.alternating as Part).map((x) => x.e);
    expect(got.length).toBeGreaterThanOrEqual(11);
    expect(got.every((e, i) => i === 0 || e !== got[i - 1])).toBe(true);
  });

  it('scores fast downs, then fast ups, each run all one way', () => {
    const p = speed.free as Part;
    const all = events(p);
    // The player switches about a second after each spoken change.
    const downs = all.filter((x) => x.t > after(p, 'free-down', 1000) && x.t < after(p, 'free-up', 0));
    const ups = all.filter((x) => x.t > after(p, 'free-up', 1000));
    expect(downs.length).toBeGreaterThanOrEqual(8);
    expect(downs.every((x) => x.e === 'correct')).toBe(true);
    expect(ups.length).toBeGreaterThanOrEqual(7);
    expect(ups.every((x) => x.e === 'pass')).toBe(true);
  });
});

describe('calibration from recorded tilts', () => {
  function calibrate(p: Part) {
    const tracker = new PitchTracker(XYZ);
    const catcher = new GestureCatcher();
    const caught = [];
    for (const s of samples(p)) {
      tracker.update(s);
      const g = catcher.update(tracker.pitch, tracker.rate, s.t);
      if (g) caught.push(g);
    }
    return caught;
  }

  it('catches every practice tilt with its direction', () => {
    expect(calibrate(fast).map((g) => (g.dir === 'down' ? 'correct' : 'pass'))).toEqual(cued(fast));
  });

  it('then lets no talking, laughing or looking around score', () => {
    const th = thresholdsFrom(calibrate(fast));
    expect(play(noise, th)).toEqual([]);
    expect(play(fast, th)).toEqual(cued(fast));
  });
});

describe('thresholdsFrom', () => {
  it('keeps defaults for a side with no tilts and stays within limits', () => {
    expect(thresholdsFrom([])).toEqual(DEFAULT_TILT);
    const th = thresholdsFrom([{ dir: 'down', amp: 200, rate: 5000 }, { dir: 'up', amp: 1, rate: 1 }]);
    expect(th.down).toBe(ANGLE_LIMITS[1]);
    expect(th.up).toBe(ANGLE_LIMITS[0]);
    expect(th.rate).toBeLessThanOrEqual(RATE_LIMITS[1]);
    expect(thresholdsFrom([{ dir: 'down', amp: 40, rate: 300 }]).up).toBe(DEFAULT_TILT.up);
  });
});

describe('edgeOf', () => {
  it('names the edge that is up and keeps it while the phone is near flat', () => {
    expect(edgeOf([9.8, 0, 1], null)).toBe('x+');
    expect(edgeOf([-9.8, 0, 1], null)).toBe('x-');
    expect(edgeOf([0, 9.8, 1], null)).toBe('y+');
    expect(edgeOf([-0.5, 0.3, -9.7], 'x+')).toBe('x+');
  });
});

describe('PitchTracker with broken timing or partial readings', () => {
  const G = 9.81;
  /** A sideways phone (right edge up) at pitch `deg`, turning at `rate` °/s on beta (Firefox layout). */
  const at = (deg: number, t: number, rate = 0, rot?: [number, number, number]): MotionSample => {
    const r = (deg * Math.PI) / 180;
    return { t, g: [G * Math.cos(r), 0, G * Math.sin(r)], lin: [0, 0, 0], rot: rot ?? [0, rate, 0] };
  };

  it('starts again from gravity after a gap instead of integrating across it', () => {
    const tr = new PitchTracker(XYZ);
    for (let t = 0; t <= 1000; t += 16) tr.update(at(0, t));
    tr.update(at(0, 11000, 400)); // ten seconds later, one fast gyro reading, phone still upright
    expect(Math.abs(tr.pitch)).toBeLessThan(1);
    expect(tr.rate).toBe(0);
  });

  it('ignores a repeated or backwards time and a missing one', () => {
    const tr = new PitchTracker(XYZ);
    for (let t = 0; t <= 500; t += 16) tr.update(at(0, t));
    tr.update(at(-30, 480, -300)); // tilting: the blend lags gravity
    const before = tr.pitch;
    expect(tr.update(at(-60, 480))).toBe(false);
    expect(tr.update(at(-60, 400))).toBe(false);
    expect(tr.update(at(-60, NaN))).toBe(false);
    expect(tr.pitch).toBe(before);
  });

  it('does not reverse the nod on one stray reading of the other edge up', () => {
    const tr = new PitchTracker(XYZ);
    for (let t = 0; t <= 500; t += 16) tr.update(at(0, t));
    tr.update({ t: 516, g: [-8, 0, -5], lin: [0, 0, 0], rot: [0, -300, 0] });
    expect(tr.rate).toBe(-300); // still read as the right edge up: a nod down
  });

  it('uses the rotation field its layout needs when another is missing', () => {
    const tr = new PitchTracker(XYZ);
    for (let t = 0; t <= 500; t += 16) tr.update(at(0, t));
    tr.update(at(-5, 532, 0, [NaN, -300, 0]));
    expect(tr.rate).toBe(-300);
  });
});
