// Tilt calibration: the player makes a few practice tilts, each one is measured (which way, how
// far, how fast), and the scoring thresholds are set from them, so a big tilter is not scored by
// a laugh and a small nodder is not ignored. Replaces the old Small / Medium / Big setting.

import { DEFAULT_TILT, type TiltThresholds } from './tilt';

export type Direction = 'down' | 'up';
export interface Gesture { dir: Direction; amp: number; rate: number }

/** A movement starts when the pitch turns faster than this (°/s)... */
const START_RATE = 60;
/** ...and is measured over this long. */
const WINDOW_MS = 700;
/** Smaller movements are not counted as tilts. */
const MIN_AMP = 10;
/** The phone must then turn slower than QUIET_RATE for QUIET_MS before the next one. */
const QUIET_RATE = 30;
const QUIET_MS = 250;
const HISTORY_MS = 1000;
const LEAD_MS = 300;

/**
 * Thresholds land at these fractions of the player's typical tilt, within these limits. The
 * angle can sit low because the speed bar already keeps out laughing and looking around (it
 * stayed under ~105°/s in the recordings, while deliberate tilts turned at 170°/s and up).
 */
export const ANGLE_SHARE = 0.35;
export const RATE_SHARE = 0.5;
export const ANGLE_LIMITS: [number, number] = [12, 25];
export const RATE_LIMITS: [number, number] = [60, 150];

function median(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const clamp = (x: number, [lo, hi]: [number, number]) => Math.max(lo, Math.min(hi, x));

/** Finds tilts in a stream of pitch samples, generously: calibration wants every attempt. */
export class GestureCatcher {
  private history: { t: number; p: number }[] = [];
  private capture: { from: number; base: number; lo: number; hi: number; rate: number } | null = null;
  private quietSince: number | null = null;
  private readyUntil = -Infinity;

  update(pitch: number, rate: number, t: number): Gesture | null {
    if (!Number.isFinite(pitch)) return null;
    const c = this.capture;
    if (c) {
      c.lo = Math.min(c.lo, pitch - c.base);
      c.hi = Math.max(c.hi, pitch - c.base);
      c.rate = Math.max(c.rate, Math.abs(rate));
      if (t - c.from < WINDOW_MS) return null;
      this.capture = null;
      this.quietSince = null;
      this.history = [];
      const dir: Direction = -c.lo > c.hi ? 'down' : 'up';
      const amp = Math.max(-c.lo, c.hi);
      return amp >= MIN_AMP ? { dir, amp, rate: c.rate } : null;
    }
    this.history.push({ t, p: pitch });
    while (this.history.length && this.history[0].t < t - HISTORY_MS) this.history.shift();
    if (Math.abs(rate) < QUIET_RATE) this.quietSince ??= t;
    else if (this.quietSince != null) {
      // A tilt speeds up through the in-between rates: it may start up to LEAD_MS after a still spell.
      if (t - this.quietSince >= QUIET_MS) this.readyUntil = t + LEAD_MS;
      this.quietSince = null;
    }
    if (t <= this.readyUntil && Math.abs(rate) >= START_RATE) {
      this.readyUntil = -Infinity;
      const base = median(this.history.map((s) => s.p));
      this.capture = { from: t, base, lo: pitch - base, hi: pitch - base, rate: Math.abs(rate) };
    }
    return null;
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
