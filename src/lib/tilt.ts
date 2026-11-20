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

/**
 * Used until a player calibrates: the owner's calibration from 64 recorded practice tilts
 * (Tilt lab, 2026-11-20; median 81° down / 57° up, slowest 175°/s), with up raised from 20° to
 * 25°: in a recorded speed run the head lifted about 21° at 195°/s just before nodding down, and
 * at 20° that wind-up scored as a pass. A player who tilts more gently should calibrate.
 */
export const DEFAULT_TILT: TiltThresholds = { down: 25, up: 25, rate: 150 };
export const RATE_WINDOW_MS = 400;
/**
 * The neutral band: within this fraction of each side's threshold of the baseline. Held for
 * NEUTRAL_HOLD_MS, it re-arms both directions and the baseline starts following the head again.
 */
export const REARM_FRACTION = 0.4;
export const NEUTRAL_HOLD_MS = 150;
/**
 * Quick tilts in a row, without that hold. The same direction again counts as soon as the phone
 * is back inside the neutral band. The other direction counts at once only well clear of the
 * bounce: on the way back from a tilt the head swings past rest by up to about REBOUND_DEG
 * (recorded: up to 28° from a +4° rest), so right after a score the other side needs
 * max(its threshold, REBOUND_DEG) plus OPPOSITE_EXTRA_DEG (40° by default; recorded tilts reach
 * 41° and beyond). Tuned on three Tilt lab recordings, a speed run among them.
 */
export const REBOUND_DEG = 25;
export const OPPOSITE_EXTRA_DEG = 15;
/**
 * The same direction re-arms no sooner than this after a score: a real tilt and return takes
 * 300 ms or more, while the shove at the start of a nod can flick the gravity-only reading back
 * to rest for a moment.
 */
export const QUICK_REARM_MS = 150;
/** "On the forehead": screen within this many degrees of vertical. */
export const READY_UPRIGHT_DEG = 35;
/** A resting pitch further from vertical than this is clamped; Ready accepts the same range. */
export const BASELINE_MAX_DEG = READY_UPRIGHT_DEG;
/**
 * The second way to settle: the phone held still (within STILL_DEG for STILL_MS) anywhere
 * within BASELINE_MAX_DEG of vertical, at least halfway back from the side that last scored.
 * That pose becomes the new baseline, so a missed or stale baseline (tap start, a reload, the
 * player leaning back mid-round) can never leave the detector stuck.
 */
export const STILL_DEG = 4;
export const STILL_MS = 300;
/**
 * The rolling baseline: once settled, the baseline is the median of the readings inside the
 * neutral band over the last ROLL_MS, leaving out the newest LAG_MS so a quick nod stands out
 * against where the head just was, and only once ROLL_MIN_MS of them have built up since the
 * last score or re-base. Readings outside the band (tilts, slow or missed ones too, and fast
 * spamming) never pull it along: in a recorded speed run, following every reading dragged it to
 * -28° and every tilt up after that was lost. It moves at most BASE_DRIFT_DEG_S. Frozen from a
 * score until the phone settles again. Slow drift is followed; a tilt slower than about 20° a
 * second is absorbed as drift and does not score.
 */
export const ROLL_MS = 2000;
export const LAG_MS = 250;
export const ROLL_MIN_MS = 500;
export const BASE_DRIFT_DEG_S = 10;

function median(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function pitchDeg(u2: number): number {
  return (Math.asin(Math.max(-1, Math.min(1, u2))) * 180) / Math.PI;
}

const finiteOr = (x: number, fallback: number) => (Number.isFinite(x) ? x : fallback);
const clampBase = (x: number) => Math.max(-BASELINE_MAX_DEG, Math.min(BASELINE_MAX_DEG, x));
const other = (e: TiltEvent): TiltEvent => (e === 'correct' ? 'pass' : 'correct');
const EVENTS: TiltEvent[] = ['correct', 'pass'];

/** A direction that may score: speed counts from `since`; `extra` raises its angle (see REBOUND_DEG). */
type Arm = { since: number; extra: number };

export class TiltDetector {
  /** Both directions at their plain thresholds, the baseline following the head. */
  private settled = false;
  private arm: Record<TiltEvent, Arm | null> = { correct: null, pass: null };
  private firedAt = NaN;
  private neutralSince: number | null = null;
  private base: number;
  private last: TiltEvent | null = null;
  /** Furthest pitch reached since the last score, on the side that scored. */
  private extreme = NaN;
  private stillRef = NaN;
  private stillSince = 0;
  /** Recent samples for the rolling baseline, cleared on a score and on a re-base. */
  private recent: { t: number; p: number }[] = [];
  private lastRollT = NaN;
  /** Signed pitch rate (°/s, + = up) over the last RATE_WINDOW_MS. */
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
    this.base = Number.isFinite(baselineDeg) ? clampBase(baselineDeg) : 0;
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

  /** One pitch sample (°) with its rate (°/s, + = turning up), e.g. from PitchTracker. */
  step(pitch: number, rate: number, nowMs: number): TiltEvent | null {
    if (!Number.isFinite(pitch) || !Number.isFinite(nowMs)) return null;
    this.rates.push({ t: nowMs, r: Number.isFinite(rate) ? rate : 0 });
    while (this.rates.length && this.rates[0].t < nowMs - RATE_WINDOW_MS) this.rates.shift();
    if (this.settled) this.roll(pitch, nowMs);
    const rel = pitch - this.base;
    if (!(Math.abs(pitch - this.stillRef) <= STILL_DEG)) {
      this.stillRef = pitch;
      this.stillSince = nowMs;
    }
    if (!this.settled && this.last) {
      this.extreme = this.last === 'correct' ? Math.min(this.extreme, pitch) : Math.max(this.extreme, pitch);
    }
    const e = this.scored(rel, nowMs);
    if (e) return this.fired(e, pitch, nowMs);
    if (!this.settled) this.recover(pitch, rel, nowMs);
    return null;
  }

  /** The direction this sample scores, if any: far enough, and turned fast enough that way. */
  private scored(rel: number, nowMs: number): TiltEvent | null {
    for (const e of EVENTS) {
      const a = this.arm[e];
      if (!a) continue;
      const need = a.extra ? Math.max(this.angle(e), REBOUND_DEG) + a.extra : this.angle(e);
      if (this.signed(e, rel) >= need && this.quickSince(e, a.since)) return e;
    }
    return null;
  }

  /** After a score: quick re-arm for the same direction, then settling. */
  private recover(pitch: number, rel: number, nowMs: number): void {
    const last = this.last;
    if (last && !this.arm[last] && nowMs - this.firedAt >= QUICK_REARM_MS && this.signed(last, rel) <= this.angle(last) * REARM_FRACTION) {
      this.arm[last] = { since: nowMs, extra: 0 };
    }
    if (this.neutral(rel)) {
      this.neutralSince ??= nowMs;
      if (nowMs - this.neutralSince >= NEUTRAL_HOLD_MS) this.settle(nowMs);
    } else {
      this.neutralSince = null;
      if (this.settledElsewhere(pitch, nowMs)) {
        this.base = pitch;
        this.settle(nowMs);
      }
    }
  }

  private neutral(rel: number): boolean {
    return rel >= -this.fire.down * REARM_FRACTION && rel <= this.fire.up * REARM_FRACTION;
  }

  private angle(e: TiltEvent): number {
    return e === 'correct' ? this.fire.down : this.fire.up;
  }

  /** How far past the baseline toward `e` (degrees; negative = the other way). */
  private signed(e: TiltEvent, rel: number): number {
    return e === 'correct' ? -rel : rel;
  }

  /** The phone turned toward `e` fast enough since `since`: a nod, not drift or the way back. */
  private quickSince(e: TiltEvent, since: number): boolean {
    return this.rates.some((x) => x.t >= since && this.signed(e, x.r) >= this.fire.rate);
  }

  /** Moves the baseline toward the median of the last ROLL_MS, newest LAG_MS left out. */
  private roll(pitch: number, nowMs: number): void {
    const dt = Number.isFinite(this.lastRollT) ? Math.max(0, nowMs - this.lastRollT) / 1000 : 0;
    this.lastRollT = nowMs;
    if (!this.neutral(pitch - this.base)) return; // only readings near the current rest
    this.recent.push({ t: nowMs, p: pitch });
    while (this.recent.length && this.recent[0].t < nowMs - ROLL_MS) this.recent.shift();
    const settled = this.recent.filter((s) => s.t <= nowMs - LAG_MS);
    if (!settled.length || settled[settled.length - 1].t - settled[0].t < ROLL_MIN_MS - LAG_MS) return;
    const m = median(settled.map((s) => s.p));
    const step = BASE_DRIFT_DEG_S * dt;
    this.base = clampBase(Math.max(this.base - step, Math.min(this.base + step, m)));
  }

  private settledElsewhere(pitch: number, nowMs: number): boolean {
    if (nowMs - this.stillSince < STILL_MS || Math.abs(pitch) > BASELINE_MAX_DEG) return false;
    // At least halfway back from the far end of the tilt that scored, toward where it started
    // (and never less than half a threshold): a player who was leaning back before a held tilt
    // and returns upright re-arms there.
    if (this.last === 'correct') return pitch - this.extreme > Math.max(this.fire.down, this.base - this.extreme) / 2;
    if (this.last === 'pass') return this.extreme - pitch > Math.max(this.fire.up, this.extreme - this.base) / 2;
    return true;
  }

  /** Both directions armed at their plain thresholds; speed counts from now (or an earlier quick re-arm). */
  private settle(nowMs: number): void {
    this.settled = true;
    this.neutralSince = null;
    for (const e of EVENTS) {
      const keep = this.arm[e] && !this.arm[e]!.extra ? this.arm[e]!.since : nowMs;
      this.arm[e] = { since: Math.min(keep, nowMs), extra: 0 };
    }
    this.lastRollT = nowMs;
  }

  reset(): void {
    this.settled = false;
    this.arm = { correct: null, pass: null };
    this.neutralSince = null;
    this.last = null;
    this.stillRef = NaN;
    this.recent = [];
    this.rates = [];
  }

  private fired(e: TiltEvent, pitch: number, nowMs: number): TiltEvent {
    this.settled = false;
    this.arm = { [e]: null, [other(e)]: { since: nowMs, extra: OPPOSITE_EXTRA_DEG } } as Record<TiltEvent, Arm | null>;
    this.neutralSince = null;
    this.last = e;
    this.firedAt = nowMs;
    this.extreme = pitch;
    this.stillRef = NaN;
    this.recent = [];
    return e;
  }
}

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

  /** `pitch`: the scoring pitch for this reading (PitchTracker), so the resting pose matches it. */
  update(g: readonly [number, number, number], nowMs: number, pitch?: number): boolean {
    const mag = Math.hypot(g[0], g[1], g[2]);
    if (!(mag > 1)) {
      this.reset(); // a broken reading breaks the hold
      return false;
    }
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
    this.thetaSum += pitch != null && Number.isFinite(pitch) ? pitch : theta;
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
