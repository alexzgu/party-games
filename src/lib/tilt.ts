// Tilt gestures for the forehead game, as a pure state machine over gravity samples
// (ported from word_guesser's device-tested detector) so it can be unit-tested.
//
// theta = asin(g_z / |g|): the screen-normal pitch. 0° with the phone upright on a forehead,
// +90° screen to the ceiling, -90° screen to the floor.

export type TiltEvent = 'correct' | 'pass';

/** Asymmetric on purpose: a phone resting on a forehead leans screen-up, so "down" fires earlier. */
export const FIRE_DOWN_DEG = 40;
export const FIRE_UP_DEG = 55;
export const NEUTRAL_DEG = 25;
export const NEUTRAL_HOLD_MS = 150;

export class TiltDetector {
  /** Starts fired: the phone must settle at neutral before the first gesture can count. */
  private armed = false;
  private neutralSince: number | null = null;

  update(g: readonly [number, number, number], nowMs: number): TiltEvent | null {
    const mag = Math.hypot(g[0], g[1], g[2]);
    if (!(mag > 1)) return null; // garbage or missing sample
    const theta = (Math.asin(Math.max(-1, Math.min(1, g[2] / mag))) * 180) / Math.PI;

    if (this.armed) {
      if (theta <= -FIRE_DOWN_DEG) return this.fire('correct');
      if (theta >= FIRE_UP_DEG) return this.fire('pass');
      return null;
    }
    if (Math.abs(theta) <= NEUTRAL_DEG) {
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

  private fire(e: TiltEvent): TiltEvent {
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
 */
export class SteadyDetector {
  private ref: [number, number, number] | null = null;
  private since = 0;

  update(g: readonly [number, number, number], nowMs: number): boolean {
    const mag = Math.hypot(g[0], g[1], g[2]);
    if (!(mag > 1)) return false;
    const u: [number, number, number] = [g[0] / mag, g[1] / mag, g[2] / mag];
    const theta = (Math.asin(Math.max(-1, Math.min(1, u[2]))) * 180) / Math.PI;
    const sideways = Math.abs(u[0]) > Math.abs(u[1]) * 1.2;
    if (Math.abs(theta) > READY_UPRIGHT_DEG || !sideways) {
      this.ref = null;
      return false;
    }
    const cos = this.ref ? u[0] * this.ref[0] + u[1] * this.ref[1] + u[2] * this.ref[2] : -1;
    if (!this.ref || cos < Math.cos((READY_WOBBLE_DEG * Math.PI) / 180)) {
      this.ref = u;
      this.since = nowMs;
      return false;
    }
    return nowMs - this.since >= READY_HOLD_MS;
  }

  reset(): void {
    this.ref = null;
  }
}
