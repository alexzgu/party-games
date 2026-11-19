// Tilt gestures for the forehead game, as a pure state machine over gravity samples
// (ported from word_guesser's device-tested detector) so it can be unit-tested.
//
// theta = asin(g_z / |g|): the screen-normal pitch. 0° with the phone upright on a forehead,
// +90° screen to the ceiling, -90° screen to the floor. Gestures are measured from the
// player's own resting pitch (the baseline caught while the phone sat steady before the
// countdown), not from true vertical.

export type TiltEvent = 'correct' | 'pass';
export type TiltSensitivity = 'small' | 'medium' | 'big';

/** Degrees past the baseline that score: `down` for got it, `up` for pass. */
export interface TiltThresholds { down: number; up: number }

/**
 * Asymmetric on purpose: heads tip back while laughing, so "up" needs a little more.
 * 'big' is the original device-tested detector; 'small' scores on a slight nod.
 */
export const TILT_THRESHOLDS: Record<TiltSensitivity, TiltThresholds> = {
  small: { down: 22, up: 26 },
  medium: { down: 32, up: 40 },
  big: { down: 40, up: 55 },
};
/**
 * Re-arms only after the phone is back within this fraction of each side's threshold of the
 * baseline, held NEUTRAL_HOLD_MS: one nod never scores twice, and swinging back up after a
 * "got it" passes through neutral too fast to arm a pass.
 */
export const REARM_FRACTION = 0.4;
export const NEUTRAL_HOLD_MS = 150;
/** A resting pitch further from vertical than this is clamped: a bad capture cannot break play. */
export const BASELINE_MAX_DEG = 25;

function pitchDeg(u2: number): number {
  return (Math.asin(Math.max(-1, Math.min(1, u2))) * 180) / Math.PI;
}

export class TiltDetector {
  /** Starts fired: the phone must settle at neutral before the first gesture can count. */
  private armed = false;
  private neutralSince: number | null = null;
  private readonly base: number;
  private readonly fire: TiltThresholds;

  /** `baselineDeg`: the player's resting pitch; 0 (true vertical) when none was caught. */
  constructor(sensitivity: TiltSensitivity, baselineDeg = 0) {
    this.fire = TILT_THRESHOLDS[sensitivity] ?? TILT_THRESHOLDS.small;
    this.base = Number.isFinite(baselineDeg)
      ? Math.max(-BASELINE_MAX_DEG, Math.min(BASELINE_MAX_DEG, baselineDeg))
      : 0;
  }

  update(g: readonly [number, number, number], nowMs: number): TiltEvent | null {
    const mag = Math.hypot(g[0], g[1], g[2]);
    if (!(mag > 1)) return null; // garbage or missing sample
    const rel = pitchDeg(g[2] / mag) - this.base;

    if (this.armed) {
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
    }
    return null;
  }

  reset(): void {
    this.armed = false;
    this.neutralSince = null;
  }

  private fired(e: TiltEvent): TiltEvent {
    this.armed = false;
    this.neutralSince = null;
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
