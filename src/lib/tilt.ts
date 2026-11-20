// Tilt gestures for the forehead game, as a pure state machine over pitch samples so it can be
// unit-tested. Pitch comes from PitchTracker (src/lib/pitch.ts) during play, or straight from
// gravity in `update` (tests, the Settings check).
//
// Pitch: 0° with the phone upright on a forehead, +90° screen to the ceiling, -90° screen to the
// floor. Gestures are measured from the player's own resting pitch, not from true vertical: it
// starts as the pitch caught while the phone sat steady before the countdown, then follows where
// the phone has been over the last two seconds, so a head that slowly drifts never makes one
// side easier than the other.

import { pitchOf } from './pitch';

export type TiltEvent = 'correct' | 'pass';

/**
 * Degrees past the baseline that score (`down` got it, `up` pass), and the pitch speed (°/s)
 * the phone must have reached within RATE_WINDOW_MS: recorded nods turn at 170-840°/s, while
 * talking, laughing, looking around and leaning back stayed under about 105°/s.
 */
export interface TiltThresholds { down: number; up: number; rate: number }

/** Used until the player calibrates. */
export const DEFAULT_TILT: TiltThresholds = { down: 25, up: 25, rate: 80 };
export const RATE_WINDOW_MS = 400;
/**
 * Re-arms only after the phone is back within this fraction of each side's threshold of the
 * baseline, held NEUTRAL_HOLD_MS: one nod never scores twice, and swinging back up after a
 * "got it" passes through neutral too fast to arm a pass.
 */
export const REARM_FRACTION = 0.4;
export const NEUTRAL_HOLD_MS = 150;
/** A resting pitch further from vertical than this is clamped: a bad capture cannot break play. */
export const BASELINE_MAX_DEG = 25;
/**
 * The second way to re-arm: the phone held still (within STILL_DEG for STILL_MS) anywhere
 * within BASELINE_MAX_DEG of vertical, at least halfway back from the side that last scored.
 * That pose becomes the new baseline, so a missed or stale baseline (tap start, a reload, the
 * player leaning back mid-round) can never leave the detector stuck.
 */
export const STILL_DEG = 4;
export const STILL_MS = 300;
/**
 * The rolling baseline: while armed, the baseline is the median pitch over the last
 * ROLL_MS, leaving out the newest LAG_MS so a quick nod stands out against where the head
 * just was, and only once ROLL_MIN_MS of samples have built up since the last score or
 * re-base. Frozen from a score until the phone re-arms, so a held tilt can never drag it
 * along and make the way back count as the opposite gesture. A tilt slower than about
 * 20° a second is absorbed as drift and does not score.
 */
export const ROLL_MS = 2000;
export const LAG_MS = 250;
export const ROLL_MIN_MS = 500;

function median(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function pitchDeg(u2: number): number {
  return (Math.asin(Math.max(-1, Math.min(1, u2))) * 180) / Math.PI;
}

const finiteOr = (x: number, fallback: number) => (Number.isFinite(x) ? x : fallback);

export class TiltDetector {
  /** Starts fired: the phone must settle at neutral before the first gesture can count. */
  private armed = false;
  private neutralSince: number | null = null;
  private base: number;
  private last: TiltEvent | null = null;
  /** Furthest pitch reached since the last score, on the side that scored. */
  private extreme = NaN;
  private stillRef = NaN;
  private stillSince = 0;
  /** Recent samples for the rolling baseline, cleared on a score and on a re-base. */
  private recent: { t: number; p: number }[] = [];
  /** |pitch rate| over the last RATE_WINDOW_MS. */
  private rates: { t: number; r: number }[] = [];
  private lastPitch = NaN;
  private lastT = NaN;
  private readonly fire: TiltThresholds;

  /** `baselineDeg`: the player's resting pitch; 0 (true vertical) when none was caught. */
  constructor(thresholds: TiltThresholds = DEFAULT_TILT, baselineDeg = 0) {
    this.fire = {
      down: finiteOr(thresholds.down, DEFAULT_TILT.down),
      up: finiteOr(thresholds.up, DEFAULT_TILT.up),
      rate: finiteOr(thresholds.rate, DEFAULT_TILT.rate),
    };
    this.base = Number.isFinite(baselineDeg)
      ? Math.max(-BASELINE_MAX_DEG, Math.min(BASELINE_MAX_DEG, baselineDeg))
      : 0;
  }

  /** Gravity only: pitch straight from the reading, its rate from the previous one. */
  update(g: readonly [number, number, number], nowMs: number): TiltEvent | null {
    const pitch = pitchOf([g[0], g[1], g[2]]);
    if (pitch == null) return null; // garbage or missing sample
    const dt = (nowMs - this.lastT) / 1000;
    const rate = dt > 0 ? (pitch - this.lastPitch) / dt : 0;
    this.lastPitch = pitch;
    this.lastT = nowMs;
    return this.step(pitch, Number.isFinite(rate) ? rate : 0, nowMs);
  }

  /** One pitch sample (°) with its rate (°/s), e.g. from PitchTracker. */
  step(pitch: number, rate: number, nowMs: number): TiltEvent | null {
    if (!Number.isFinite(pitch)) return null;
    this.rates.push({ t: nowMs, r: Math.abs(rate) });
    while (this.rates.length && this.rates[0].t < nowMs - RATE_WINDOW_MS) this.rates.shift();
    if (this.armed) this.roll(pitch, nowMs);
    const rel = pitch - this.base;
    if (!(Math.abs(pitch - this.stillRef) <= STILL_DEG)) {
      this.stillRef = pitch;
      this.stillSince = nowMs;
    }

    if (!this.armed && this.last) {
      this.extreme = this.last === 'correct' ? Math.min(this.extreme, pitch) : Math.max(this.extreme, pitch);
    }
    if (this.armed) {
      if (!this.quick()) return null;
      if (rel <= -this.fire.down) return this.fired('correct');
      if (rel >= this.fire.up) return this.fired('pass');
      return null;
    }
    if (rel >= -this.fire.down * REARM_FRACTION && rel <= this.fire.up * REARM_FRACTION) {
      if (this.neutralSince == null) this.neutralSince = nowMs;
      else if (nowMs - this.neutralSince >= NEUTRAL_HOLD_MS) {
        this.armed = true;
        this.neutralSince = null;
      }
    } else {
      this.neutralSince = null;
      if (this.settledElsewhere(pitch, rel, nowMs)) {
        this.base = pitch;
        this.armed = true;
        this.recent = [];
      }
    }
    return null;
  }

  /** The phone turned fast enough, recently, for this to be a nod rather than drift. */
  private quick(): boolean {
    return this.rates.some((x) => x.r >= this.fire.rate);
  }

  /** Moves the baseline to the median of the last ROLL_MS, newest LAG_MS left out. */
  private roll(pitch: number, nowMs: number): void {
    this.recent.push({ t: nowMs, p: pitch });
    while (this.recent.length && this.recent[0].t < nowMs - ROLL_MS) this.recent.shift();
    const settled = this.recent.filter((s) => s.t <= nowMs - LAG_MS);
    if (!settled.length || settled[settled.length - 1].t - settled[0].t < ROLL_MIN_MS - LAG_MS) return;
    const m = median(settled.map((s) => s.p));
    this.base = Math.max(-BASELINE_MAX_DEG, Math.min(BASELINE_MAX_DEG, m));
  }

  private settledElsewhere(pitch: number, rel: number, nowMs: number): boolean {
    if (nowMs - this.stillSince < STILL_MS || Math.abs(pitch) > BASELINE_MAX_DEG) return false;
    // At least halfway back from the far end of the tilt that scored, toward where it started
    // (and never less than half a threshold): a player who was leaning back before a held tilt
    // and returns upright re-arms there.
    if (this.last === 'correct') return pitch - this.extreme > Math.max(this.fire.down, this.base - this.extreme) / 2;
    if (this.last === 'pass') return this.extreme - pitch > Math.max(this.fire.up, this.extreme - this.base) / 2;
    return true;
  }

  reset(): void {
    this.armed = false;
    this.neutralSince = null;
    this.last = null;
    this.stillRef = NaN;
    this.recent = [];
  }

  private fired(e: TiltEvent): TiltEvent {
    this.armed = false;
    this.neutralSince = null;
    this.last = e;
    this.extreme = this.base + (e === 'correct' ? -this.fire.down : this.fire.up);
    this.stillRef = NaN;
    this.recent = [];
    return e;
  }
}

/** "On the forehead": screen within this many degrees of vertical. */
export const READY_UPRIGHT_DEG = 35;
/** How much the phone may wobble while counting as steady. */
export const READY_WOBBLE_DEG = 12;
export const READY_HOLD_MS = 700;

/**
 * Fires once the phone has been held near vertical, sideways (landscape) and steady for
 * READY_HOLD_MS: the sign that it is on someone's forehead and the countdown can start.
 * Meanwhile it averages the pitch over the steady hold: the player's resting pose.
 */
export class SteadyDetector {
  private ref: [number, number, number] | null = null;
  private since = 0;
  private thetaSum = 0;
  private thetaN = 0;

  update(g: readonly [number, number, number], nowMs: number): boolean {
    const mag = Math.hypot(g[0], g[1], g[2]);
    if (!(mag > 1)) return false;
    const u: [number, number, number] = [g[0] / mag, g[1] / mag, g[2] / mag];
    const theta = pitchDeg(u[2]);
    const sideways = Math.abs(u[0]) > Math.abs(u[1]) * 1.2;
    if (Math.abs(theta) > READY_UPRIGHT_DEG || !sideways) {
      this.reset();
      return false;
    }
    const cos = this.ref ? u[0] * this.ref[0] + u[1] * this.ref[1] + u[2] * this.ref[2] : -1;
    if (!this.ref || cos < Math.cos((READY_WOBBLE_DEG * Math.PI) / 180)) {
      this.ref = u;
      this.since = nowMs;
      this.thetaSum = 0;
      this.thetaN = 0;
    }
    this.thetaSum += theta;
    this.thetaN++;
    return nowMs - this.since >= READY_HOLD_MS;
  }

  /** Mean pitch in degrees over the current steady hold; null when there is none. */
  baseline(): number | null {
    return this.ref && this.thetaN > 0 ? this.thetaSum / this.thetaN : null;
  }

  reset(): void {
    this.ref = null;
    this.thetaSum = 0;
    this.thetaN = 0;
  }
}
