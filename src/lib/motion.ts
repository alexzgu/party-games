// Device motion for the forehead game: permission, a normalised gravity stream, and the
// sign fix for platforms that report gravity with inverted axes.

export type Gravity = [number, number, number];

type PermissionFn = () => Promise<'granted' | 'denied' | 'default'>;

/** True when motion needs an explicit permission prompt (iPhone/iPad Safari). */
export function motionNeedsPermission(): boolean {
  return typeof (DeviceMotionEvent as unknown as { requestPermission?: PermissionFn }).requestPermission === 'function';
}

/** Must run inside a tap handler on iOS. Resolves true when motion events are allowed. */
export async function requestMotion(): Promise<boolean> {
  if (typeof DeviceMotionEvent === 'undefined') return false;
  const req = (DeviceMotionEvent as unknown as { requestPermission?: PermissionFn }).requestPermission;
  if (typeof req !== 'function') return true;
  try {
    return (await req.call(DeviceMotionEvent)) === 'granted';
  } catch {
    return false;
  }
}

/**
 * The page's rotation from the device's natural (portrait) orientation, in degrees
 * counter-clockwise device turn: 90 = phone turned so its top points left.
 * `window.orientation` is preferred because its convention is documented and identical on
 * iOS Safari and Android Chrome (90 = turned counter-clockwise, -90 = clockwise);
 * `screen.orientation.angle` is the fallback.
 */
export function screenAngle(): 0 | 90 | 180 | 270 {
  const legacy = (globalThis as unknown as { orientation?: unknown }).orientation;
  const raw = typeof legacy === 'number' ? legacy : (globalThis.screen?.orientation?.angle ?? 0);
  return ((((Math.round(raw / 90) * 90) % 360) + 360) % 360) as 0 | 90 | 180 | 270;
}

/**
 * Device-frame gravity (x right, y up, z out of the screen, phone in portrait) expressed in
 * the page's frame (x to the page's right, y to the page's top) for a page turned `angle`.
 */
export function toScreen(g: Gravity, angle: number): Gravity {
  const r = (angle * Math.PI) / 180;
  const c = Math.round(Math.cos(r));
  const s = Math.round(Math.sin(r));
  return [g[0] * c - g[1] * s, g[0] * s + g[1] * c, g[2]];
}

/** |y + z| (page frame, m/s²) below this is too close to zero to tell the axis sign. */
export const SIGN_CONFIDENT = 4;

/**
 * Per the DeviceMotion spec, accelerationIncludingGravity points away from the floor: a phone
 * lying screen-up reports z ≈ +9.8 and one held upright in portrait reports y ≈ +9.8. Some
 * iOS builds report every axis inverted.
 *
 * Only valid for a sample taken while the player is reading the screen (the Start tap): then
 * the content's top points up-ish and the screen faces up-ish, so in the page frame y + z is
 * clearly positive. Using y as well as z matters because people often hold the phone almost
 * vertical to read, where z alone is near zero. Returns null when the reading is too weak to
 * tell; callers keep their previous answer. Never call it for a phone on a forehead: there y
 * can be large with either sign (the page may be upside down for the holder).
 */
export function axisSignFromLookingAt(g: Gravity | null, angle = 0): 1 | -1 | null {
  if (!g) return null;
  const s = toScreen(g, angle);
  const score = s[1] + s[2];
  if (Math.abs(score) < SIGN_CONFIDENT) return null;
  return score > 0 ? 1 : -1;
}

/** Streams gravity samples (m/s², spec sign convention after `sign`). Returns an unsubscribe. */
export function watchGravity(onSample: (g: Gravity, t: number) => void, sign: 1 | -1 = 1): () => void {
  const handler = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null || a.y == null || a.z == null) return;
    onSample([a.x * sign, a.y * sign, a.z * sign], e.timeStamp || performance.now());
  };
  addEventListener('devicemotion', handler);
  return () => removeEventListener('devicemotion', handler);
}

/** The most recent sample, for one-off reads such as the sign check at Start. */
export function latestGravity(): () => Gravity | null {
  let last: Gravity | null = null;
  const stop = watchGravity((g) => { last = g; });
  return () => { stop(); return last; };
}

/** Which device edge points up, as the clockwise turn from the top edge: 0 top, 90 right, 180 bottom, 270 left. */
export type UpEdge = 0 | 90 | 180 | 270;

/** The device edge closest to straight up, or null when the phone is too close to flat or diagonal to tell. */
export function upEdge(g: Gravity, minRatio = 1): UpEdge | null {
  const [x, y] = g;
  const ax = Math.abs(x), ay = Math.abs(y);
  if (Math.max(ax, ay) < 2) return null;
  if (ax > ay) return ax >= ay * minRatio ? (x > 0 ? 90 : 270) : null;
  return ay >= ax * minRatio ? (y >= 0 ? 0 : 180) : null;
}

/** CSS rotation (clockwise degrees) that puts the content's top on the device edge `edge`, for a page turned `angle`. */
export function rotationFor(edge: UpEdge, angle: number): 0 | 90 | -90 | 180 {
  const r = ((((edge - angle) % 360) + 360) % 360);
  return (r === 270 ? -90 : r) as 0 | 90 | -90 | 180;
}

/**
 * How many degrees (CSS rotate, clockwise) to turn the game screen so its text reads upright
 * for the people facing the phone, even when the phone's rotation lock keeps the page in
 * portrait. Example: page in portrait (angle 0), phone sideways with its right edge up, so
 * gravity runs along +x: the content's top must move to the right edge, a 90° clockwise turn.
 */
export function uprightRotation(g: Gravity, angle = 0): 0 | 90 | -90 | 180 {
  return rotationFor(upEdge(g) ?? 0, angle);
}

/**
 * Keeps the upright edge stable during play: it only changes when the phone is held near
 * vertical with a clearly different edge up for a moment, so tilting to score never flips it.
 */
export class UprightTracker {
  private since: number | null = null;
  private candidate: UpEdge | null = null;

  constructor(public edge: UpEdge = 0, private holdMs = 450) {}

  update(g: Gravity, nowMs: number): UpEdge {
    const mag = Math.hypot(g[0], g[1], g[2]);
    const nearVertical = mag > 1 && Math.abs(g[2] / mag) < 0.6; // within ~37° of vertical
    const next = nearVertical ? upEdge(g, 1.6) : null;
    if (next == null || next === this.edge) {
      this.candidate = null;
      this.since = null;
    } else if (next !== this.candidate) {
      this.candidate = next;
      this.since = nowMs;
    } else if (this.since != null && nowMs - this.since >= this.holdMs) {
      this.edge = next;
      this.candidate = null;
      this.since = null;
    }
    return this.edge;
  }
}
