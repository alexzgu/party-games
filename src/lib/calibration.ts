// Tilt calibration: the player makes a few practice tilts, each one is measured (which way, how
// far, how fast), and the scoring thresholds are set from them, so a big tilter is not scored by
// a laugh and a small nodder is not ignored. Replaces the old Small / Medium / Big setting.

import { DEFAULT_TILT, type TiltThresholds } from './tilt';

export type Direction = 'down' | 'up';
export interface Gesture { dir: Direction; amp: number; rate: number }

/**
 * Thresholds land at these fractions of the player's typical tilt, within these limits. The
 * angle can sit low because the speed bar already keeps out laughing and looking around (it
 * stayed under ~105°/s in the recordings, while deliberate tilts turned at 170°/s and up).
 */
export const ANGLE_SHARE = 0.35;
export const RATE_SHARE = 0.5;
export const ANGLE_LIMITS: [number, number] = [12, 25];
export const RATE_LIMITS: [number, number] = [60, 150];

/**
 * A practice tilt smaller than this could never score (no threshold sits below ANGLE_LIMITS[0]),
 * so it is not kept: the player is asked to tilt further instead.
 */
export const MIN_TILT = ANGLE_LIMITS[0];
/** A movement starts when the pitch turns faster than this (°/s)... */
const START_RATE = 60;
/** ...and is measured over this long. */
const WINDOW_MS = 700;
/** Movements smaller than this are not attempts at all and are passed over silently. */
const NOISE_AMP = 5;
/** The phone must then turn slower than QUIET_RATE for QUIET_MS before the next one. */
const QUIET_RATE = 30;
const QUIET_MS = 250;
const HISTORY_MS = 1000;
const LEAD_MS = 300;

function median(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const clamp = (x: number, [lo, hi]: [number, number]) => Math.max(lo, Math.min(hi, x));

/** True when a caught tilt is too small to ever score, so it must not be kept. */
export function tooSmall(g: Gesture): boolean {
  return g.amp < MIN_TILT;
}

type Capture = { from: number; base: number; lo: number; hi: number; rate: number };

/**
 * Finds tilts in a stream of pitch samples, generously: calibration wants every attempt. Each
 * gesture of at least NOISE_AMP is returned (check `tooSmall` before keeping it). After a tilt
 * big enough to count, nothing new starts until the pitch is at least halfway back to where the
 * tilt began and then goes quiet, so the way back from a held tilt is never a second gesture.
 */
export class GestureCatcher {
  private history: { t: number; p: number }[] = [];
  private capture: Capture | null = null;
  /** Where the last counted tilt began and how close (°) the pitch must come back to it. */
  private away: { base: number; within: number } | null = null;
  private quietSince: number | null = null;
  private readyUntil = -Infinity;

  update(pitch: number, rate: number, t: number): Gesture | null {
    if (!Number.isFinite(pitch)) return null;
    // A missing or broken rate reading tells nothing about speed: it is left out, not counted as 0.
    const speed = Number.isFinite(rate) ? Math.abs(rate) : null;
    if (this.capture) return this.measure(this.capture, pitch, speed, t);
    if (this.away) {
      if (Math.abs(pitch - this.away.base) > this.away.within) return null;
      this.away = null; // back: start afresh, so the next base comes from the pose after the return
      this.history = [];
      this.quietSince = null;
    }
    this.watch(pitch, speed, t);
    return null;
  }

  /** Grows the capture until its window ends, then reports it. */
  private measure(c: Capture, pitch: number, speed: number | null, t: number): Gesture | null {
    c.lo = Math.min(c.lo, pitch - c.base);
    c.hi = Math.max(c.hi, pitch - c.base);
    if (speed != null) c.rate = Math.max(c.rate, speed);
    if (t - c.from < WINDOW_MS) return null;
    this.capture = null;
    this.quietSince = null;
    this.history = [];
    const dir: Direction = -c.lo > c.hi ? 'down' : 'up';
    const amp = Math.max(-c.lo, c.hi);
    if (amp >= MIN_TILT) this.away = { base: c.base, within: amp / 2 };
    return amp >= NOISE_AMP ? { dir, amp, rate: c.rate } : null;
  }

  /** Keeps the recent pitch and starts a capture on a brisk move that follows a still spell. */
  private watch(pitch: number, speed: number | null, t: number): void {
    this.history.push({ t, p: pitch });
    while (this.history.length && this.history[0].t < t - HISTORY_MS) this.history.shift();
    if (speed == null) return;
    if (speed < QUIET_RATE) this.quietSince ??= t;
    else if (this.quietSince != null) {
      // A tilt speeds up through the in-between rates: it may start up to LEAD_MS after a still spell.
      if (t - this.quietSince >= QUIET_MS) this.readyUntil = t + LEAD_MS;
      this.quietSince = null;
    }
    if (t <= this.readyUntil && speed >= START_RATE) {
      this.readyUntil = -Infinity;
      const base = median(this.history.map((s) => s.p));
      this.capture = { from: t, base, lo: pitch - base, hi: pitch - base, rate: speed };
    }
  }
}

/** Thresholds from practice tilts; a side with no tilts keeps the default. */
export function thresholdsFrom(gestures: Gesture[]): TiltThresholds {
  const side = (d: Direction) => gestures.filter((g) => g.dir === d).map((g) => g.amp);
  const angle = (amps: number[], fallback: number) => (amps.length ? clamp(ANGLE_SHARE * median(amps), ANGLE_LIMITS) : fallback);
  const rates = gestures.map((g) => g.rate);
  return {
    down: angle(side('down'), DEFAULT_TILT.down),
    up: angle(side('up'), DEFAULT_TILT.up),
    rate: rates.length ? clamp(RATE_SHARE * median(rates), RATE_LIMITS) : DEFAULT_TILT.rate,
  };
}

const inRange = (x: unknown, limits: [number, number]) =>
  typeof x === 'number' && Number.isFinite(x) ? clamp(x, limits) : null;

/**
 * A stored calibration made safe to score with: every field must be a finite number, then each
 * is clamped into the limits calibration itself would produce (a stored 0° would score at rest).
 * Anything else is treated as no calibration.
 */
export function storedThresholds(x: unknown): TiltThresholds | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const down = inRange(o.down, ANGLE_LIMITS);
  const up = inRange(o.up, ANGLE_LIMITS);
  const rate = inRange(o.rate, RATE_LIMITS);
  return down != null && up != null && rate != null ? { down, up, rate } : null;
}
