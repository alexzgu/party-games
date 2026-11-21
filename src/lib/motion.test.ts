import { afterEach, describe, expect, it } from 'vitest';
import {
  offsetAfterTurn, offsetFromReading, rotationFor, screenAngle, stageTurn, UprightTracker,
  type Gravity, type UpEdge,
} from './motion';

// Which way the word turns, from the Start tap (player reading the screen) to the forehead.
// Gravity is accelerationIncludingGravity as the browser reports it, after the sign fix in use.
const G = 9.8;
const READING: Gravity = [0, 8, 5.6]; // top up, screen tilted back toward the reader's eyes
const flip = (g: Gravity): Gravity => [-g[0], -g[1], -g[2]];
/** Device-frame gravity with edge `e` (clockwise from the device's top) pointing up. */
const up = (e: UpEdge): Gravity => [[0, G, 0], [G, 0, 0], [0, -G, 0], [-G, 0, 0]][e / 90] as Gravity;

/** Plays a round: the Start reading at page angle `start`, then each page turn, then the forehead pose. */
function word(opts: { reading: Gravity; start: number; turns: { angle: number; g: Gravity }[]; head: Gravity; offset?: number }): number {
  let offset = opts.offset ?? 0;
  offset = offsetFromReading(opts.reading, opts.start) ?? offset;
  let angle = opts.start;
  for (const t of opts.turns) {
    offset = offsetAfterTurn(offset, t.angle, t.g);
    angle = t.angle;
  }
  const edge = new UprightTracker(0, 0);
  edge.update(opts.head, 0);
  edge.update(opts.head, 1);
  return stageTurn(edge.edge, angle, offset);
}

describe('word rotation on an ordinary Android phone (natural portrait, spec axes)', () => {
  it('needs no turn when the page turns with the phone', () => {
    expect(word({ reading: READING, start: 0, turns: [{ angle: 90, g: up(90) }], head: up(90) })).toBe(0);
    expect(word({ reading: READING, start: 0, turns: [{ angle: 270, g: up(270) }], head: up(270) })).toBe(0);
  });

  it('turns the word when auto-rotate is off and the page stays portrait', () => {
    expect(word({ reading: READING, start: 0, turns: [], head: up(90) })).toBe(90);
    expect(word({ reading: READING, start: 0, turns: [], head: up(270) })).toBe(-90);
  });

  it('keeps the landscape lock that takes hold while the phone is still upright, then follows gravity', () => {
    // Fullscreen + lock('landscape') turn the page to 90 with the phone still upright: no evidence.
    const locked = { angle: 90, g: READING };
    expect(word({ reading: READING, start: 0, turns: [locked], head: up(90) })).toBe(0);
    // Put on the forehead the other way round: the lock flips the page to 270.
    expect(word({ reading: READING, start: 0, turns: [locked, { angle: 270, g: up(270) }], head: up(270) })).toBe(0);
    // The lock could not follow (a lock that holds one landscape only): the word turns itself.
    expect(word({ reading: READING, start: 0, turns: [locked], head: up(270) })).toBe(180);
  });
});

describe('word rotation on an unfolded foldable (natural landscape)', () => {
  // Angle 0 is landscape and the motion axes follow it: y runs along the short side.
  it('needs no turn in either landscape', () => {
    expect(word({ reading: READING, start: 0, turns: [], head: up(0) })).toBe(0);
    expect(word({ reading: READING, start: 0, turns: [{ angle: 180, g: up(180) }], head: up(180) })).toBe(0);
  });

  it('turns the word upside down only when the page is held in one landscape', () => {
    expect(word({ reading: READING, start: 0, turns: [], head: up(180) })).toBe(180);
  });

  it('reads upright when the motion axes are turned against the inner screen', () => {
    // The page's top is on the device edge 180 (or 90) of the motion frame at angle 0. The browser
    // angle and gravity alone gave an upside-down (or sideways) word here.
    for (const shift of [90, 180, 270] as UpEdge[]) {
      const reading = up(shift).map((v, i) => (i === 2 ? 5.6 : v * 0.82)) as Gravity;
      expect(word({ reading, start: 0, turns: [], head: up(shift) })).toBe(0);
      expect(rotationFor(shift, 0)).not.toBe(0); // the browser angle alone
      expect(word({ reading, start: 0, turns: [{ angle: 180, g: up(((shift + 180) % 360) as UpEdge) }], head: up(((shift + 180) % 360) as UpEdge) })).toBe(0);
    }
  });
});

describe('word rotation on an iPhone 7 Plus (iOS 15: window.orientation, no screen.orientation)', () => {
  afterEach(() => { delete (globalThis as { orientation?: number }).orientation; });

  it('reads the page angle from window.orientation', () => {
    (globalThis as { orientation?: number }).orientation = -90;
    expect(screenAngle()).toBe(270);
    (globalThis as { orientation?: number }).orientation = 90;
    expect(screenAngle()).toBe(90);
  });

  it('reads upright with the axis sign still wrong (a fresh home-screen install)', () => {
    // Every axis arrives inverted and the sign fix has not been learned in this app's storage.
    const reading = flip(READING);
    // Page turns with the phone (portrait lock off).
    expect(word({ reading, start: 0, turns: [{ angle: 90, g: flip(up(90)) }], head: flip(up(90)) })).toBe(0);
    expect(word({ reading, start: 0, turns: [{ angle: 270, g: flip(up(270)) }], head: flip(up(270)) })).toBe(0);
    // Portrait lock on: the page stays portrait and the word turns to the raised edge.
    expect(word({ reading, start: 0, turns: [], head: flip(up(90)) })).toBe(90);
    expect(word({ reading, start: 0, turns: [], head: flip(up(270)) })).toBe(-90);
  });

  it('corrects a wrong offset at the first page turn when the Start reading was too flat', () => {
    const flat: Gravity = [0, -1, -9.7];
    expect(offsetFromReading(flat, 0)).toBeNull();
    expect(word({ reading: flat, start: 0, turns: [{ angle: 90, g: flip(up(90)) }], head: flip(up(90)) })).toBe(0);
  });

  it('corrects a browser that reports the turn the other way round', () => {
    // The page truly turned so its top is on the right edge; the browser says 270.
    expect(word({ reading: READING, start: 0, turns: [{ angle: 270, g: up(90) }], head: up(90) })).toBe(0);
  });
});

describe('page offset', () => {
  it('is 0 when the browser and the motion axes agree', () => {
    expect(offsetFromReading(READING, 0)).toBe(0);
    expect(offsetFromReading([8, 0, 5.6], 90)).toBe(0);
    expect(offsetFromReading([-8, 0, 5.6], 270)).toBe(0);
  });

  it('is unknown for a flat or diagonal reading', () => {
    expect(offsetFromReading([1, 2, 9.5], 0)).toBeNull();
    expect(offsetFromReading([5, 5, 6], 0)).toBeNull();
  });

  it('keeps its value for a turn gravity does not explain', () => {
    expect(offsetAfterTurn(180, 90, READING)).toBe(180); // gravity on the other axis
    expect(offsetAfterTurn(180, 90, null)).toBe(180); // no fresh reading
    expect(offsetAfterTurn(90, 0, [0.5, 1, 9.7])).toBe(90); // too flat
  });
});
