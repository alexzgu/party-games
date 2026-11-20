// The forehead pitch the tilt detector reads, built from raw device motion.
//
// Recorded nods (Tilt lab, 2026-11-20) showed why raw gravity is not enough: a quick nod first
// shoves the phone along its screen normal, and for ~100 ms the raw reading looks like a big
// tilt the OTHER way, so a "got it" nod scored as a pass. Two fixes, best first:
//  1. Blend the gyroscope (fast, blind to shoves) with gravity (slow, never drifts): a
//     complementary filter with a 1 s time constant. This got all 64 recorded quick tilts right.
//  2. Without a usable gyroscope, use the browser's own gravity estimate
//     (accelerationIncludingGravity minus acceleration), which removes most of the shove.
// Browsers disagree on which rotationRate field is which axis (Firefox on Android reports the
// nod on `beta`, the spec puts it on `gamma`), so the tracker learns the layout from the motion
// itself: each candidate runs its own blend, and the one that tracks gravity best wins.

export type Vec3 = [number, number, number];

/** One devicemotion reading, axes in the spec's sign convention. */
export interface MotionSample {
  /** accelerationIncludingGravity, m/s². */
  g: Vec3;
  /** acceleration without gravity, when the browser gives it. */
  lin: Vec3 | null;
  /** rotationRate [alpha, beta, gamma] as reported, °/s, when the browser gives it. */
  rot: Vec3 | null;
  t: number;
}

/** Which rotationRate fields hold the device x and y rates, and their sign. */
export type GyroLayout = { map: 'spec' | 'xyz'; sign: 1 | -1 };
export const GYRO_LAYOUTS: GyroLayout[] = [
  { map: 'spec', sign: 1 }, { map: 'spec', sign: -1 }, { map: 'xyz', sign: 1 }, { map: 'xyz', sign: -1 },
];

/**
 * The layout to start from before this phone has shown its own: Firefox on Android reports the
 * nod on `beta` (recorded 2026-11-20). Other browsers start unknown and learn it within the first
 * few tilts. A wrong start is replaced as soon as another layout clearly tracks gravity better.
 */
export function likelyLayout(userAgent: string): GyroLayout | null {
  return /Firefox\//.test(userAgent) && /Android/.test(userAgent) ? { map: 'xyz', sign: 1 } : null;
}

/** Blend time constant: the gyroscope rules faster changes, gravity slower ones. */
export const BLEND_S = 1;
/** Layout learning forgets evidence older than about this. */
const LEARN_S = 30;
/** Total turning (°) seen on the forehead before a layout may be chosen. */
const LEARN_MIN_DEG = 150;
/** A layout wins when its tracking error is under this fraction of the runner-up's. */
const LEARN_RATIO = 0.5;

const DEG = 180 / Math.PI;
const SLOPE_MS = 100;
/** A gap longer than this (s) between readings (the page was hidden, the sensor stalled) restarts from gravity. */
const MAX_GAP_S = 0.25;
/** Steps longer than this (s) are integrated as this long: a late reading must not overshoot. */
const MAX_STEP_S = 0.1;
/** A different edge must point up this long before the tracker believes it. */
const EDGE_HOLD_MS = 150;

export function pitchOf(v: Vec3): number | null {
  const m = Math.hypot(v[0], v[1], v[2]);
  if (!(m > 1)) return null;
  return Math.asin(Math.max(-1, Math.min(1, v[2] / m))) * DEG;
}

/** Which device edge points up: +x, -x (sideways), +y, -y (upright). */
export type Edge = 'x+' | 'x-' | 'y+' | 'y-';

/**
 * Pitch rate (°/s, + = screen turning up) from the gyroscope under a layout. The nod axis is the
 * device edge lying across the forehead: y when the phone is sideways, x when upright.
 */
export function nodRate(rot: Vec3, edge: Edge, layout: GyroLayout): number {
  const [wx, wy] = layout.map === 'spec' ? [rot[1], rot[2]] : [rot[0], rot[1]];
  const s = layout.sign * (edge.endsWith('+') ? 1 : -1);
  return edge.startsWith('x') ? s * wy : -s * wx;
}

/**
 * The edge that is up, from a gravity reading, or `keep` when the phone is too far from upright
 * to tell: mid-nod the raw reading can swing past flat and would flip the rate's sign.
 */
export function edgeOf(v: Vec3, keep: Edge | null): Edge | null {
  const m = Math.hypot(v[0], v[1], v[2]);
  if (!(m > 1) || Math.abs(v[2] / m) > 0.7) return keep;
  const [ax, ay] = [Math.abs(v[0]), Math.abs(v[1])];
  if (ax > 1.5 * ay) return v[0] > 0 ? 'x+' : 'x-';
  if (ay > 1.5 * ax) return v[1] > 0 ? 'y+' : 'y-';
  return keep;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export class PitchTracker {
  /** Degrees, 0 = screen upright, + = screen turned up. NaN until the first good reading. */
  pitch = NaN;
  /** °/s: the gyroscope's pitch rate once the layout is known, else the pitch's own rate. */
  rate = 0;
  private lastT = -Infinity;
  private edge: Edge | null = null;
  private pendingEdge: Edge | null = null;
  private pendingSince = 0;
  /** Recent gravity pitch, for a rate without a gyroscope. */
  private trail: { t: number; p: number }[] = [];
  private blends = GYRO_LAYOUTS.map(() => NaN);
  private errors = GYRO_LAYOUTS.map(() => 0);
  private evidence = 0;

  /** `layout`: the one this phone was found to use before, if any. */
  constructor(public layout: GyroLayout | null = null) {}

  update(s: MotionSample): boolean {
    if (!Number.isFinite(s.t) || s.t <= this.lastT) return false; // a repeated or backwards time
    const grav = s.lin ? sub(s.g, s.lin) : s.g;
    const ref = pitchOf(grav) ?? pitchOf(s.g);
    if (ref == null) return false;
    const gap = (s.t - this.lastT) / 1000;
    this.lastT = s.t;
    // The steadier gravity estimate decides the edge; the raw reading swings during a nod.
    this.followEdge(edgeOf(grav, this.edge), s.t);
    if (!(gap <= MAX_GAP_S)) return this.restart(ref, s.t);
    const dt = Math.min(MAX_STEP_S, gap);
    const rot = s.rot && s.rot.every(Number.isFinite) ? s.rot : null;
    if (rot && this.edge && this.learn(rot, this.edge, ref, dt)) {
      this.pitch = this.blends[this.layoutIndex()]; // switching layout: continue from its own blend
    }
    const w = this.layout && this.edge && s.rot ? nodRate(s.rot, this.edge, this.layout) : NaN;
    if (Number.isFinite(w) && Number.isFinite(this.pitch)) {
      const a = BLEND_S / (BLEND_S + dt);
      this.pitch = a * (this.pitch + w * dt) + (1 - a) * ref;
      this.rate = w;
    } else {
      this.pitch = ref;
      this.rate = this.slope(ref, s.t);
    }
    return true;
  }

  /** After a gap: start again from gravity, at rest, with nothing integrated across it. */
  private restart(ref: number, t: number): boolean {
    this.pitch = ref;
    this.rate = 0;
    this.trail = [{ t, p: ref }];
    this.blends = GYRO_LAYOUTS.map(() => NaN);
    return true;
  }

  /** Believes a new edge only once it has held for EDGE_HOLD_MS (the first one at once). */
  private followEdge(e: Edge | null, t: number): void {
    if (!this.edge || e === this.edge) {
      this.edge = e;
      this.pendingEdge = null;
    } else if (e !== this.pendingEdge) {
      this.pendingEdge = e;
      this.pendingSince = t;
    } else if (t - this.pendingSince >= EDGE_HOLD_MS) {
      this.edge = e;
      this.pendingEdge = null;
    }
  }

  private layoutIndex(): number {
    return this.layout ? GYRO_LAYOUTS.findIndex((l) => l.map === this.layout!.map && l.sign === this.layout!.sign) : -1;
  }

  /** Pitch rate over the last SLOPE_MS: one reading to the next jitters by ±150°/s at rest. */
  private slope(p: number, t: number): number {
    this.trail.push({ t, p });
    while (this.trail.length > 2 && this.trail[1].t <= t - SLOPE_MS) this.trail.shift();
    const first = this.trail[0];
    return t > first.t ? ((p - first.p) * 1000) / (t - first.t) : 0;
  }

  /**
   * Runs every layout's blend and keeps the one that tracks gravity best, while on a forehead.
   * Returns true when it switched to a different layout.
   */
  private learn(rot: Vec3, edge: Edge, ref: number, dt: number): boolean {
    const onForehead = Math.abs(ref) < 50 && edge.startsWith('x');
    const a = BLEND_S / (BLEND_S + dt);
    const keep = Math.exp(-dt / LEARN_S);
    GYRO_LAYOUTS.forEach((l, i) => {
      const prev = this.blends[i];
      if (!onForehead || !Number.isFinite(prev)) { this.blends[i] = ref; return; }
      this.blends[i] = a * (prev + nodRate(rot, edge, l) * dt) + (1 - a) * ref;
      this.errors[i] = keep * this.errors[i] + Math.abs(this.blends[i] - ref) * dt;
    });
    if (!onForehead) return false;
    this.evidence = keep * this.evidence + (Math.abs(rot[0]) + Math.abs(rot[1]) + Math.abs(rot[2])) * dt;
    if (this.evidence < LEARN_MIN_DEG) return false;
    const order = GYRO_LAYOUTS.map((_, i) => i).sort((x, y) => this.errors[x] - this.errors[y]);
    const [best, second] = order;
    const current = this.layoutIndex();
    // A known layout is replaced only when another clearly beats it.
    const rival = current >= 0 ? current : second;
    if (best === current || !(this.errors[best] < LEARN_RATIO * this.errors[rival])) return false;
    this.layout = GYRO_LAYOUTS[best];
    return true;
  }
}
