// Device glue for the forehead game: one gravity stream started in the Start tap, the axis
// sign fix learned while the player is still looking at the Start screen, the upright edge for the
// people facing the phone, and Android's fullscreen + landscape lock.
import {
  requestMotion, watchMotion, screenAngle, toScreen, axisSignFromLookingAt, rotationFor,
  upEdge, UprightTracker, type Gravity,
} from '../../lib/motion';
import { load, save } from '../../lib/storage';
import { PitchTracker, GYRO_LAYOUTS, likelyLayout, type GyroLayout, type MotionSample } from '../../lib/pitch';

export const motion = $state({
  live: false, denied: false, angle: screenAngle() as number, edge: 0 as 0 | 90 | 180 | 270,
  /** The rotation sensor: absent, present but its layout not yet learned, or in use. */
  gyro: 'none' as 'none' | 'learning' | 'learned',
});

/** CSS rotation for the play screen so it reads upright for the viewers. */
export function stageRotation(): 0 | 90 | -90 | 180 {
  return motion.live ? rotationFor(motion.edge, motion.angle) : 0;
}

/** The phone's pitch, read once per motion sample by every listener (see src/lib/pitch.ts). */
export type Pitch = { pitch: number; rate: number };
type Listener = (g: Gravity, t: number, p: Pitch) => void;
const listeners = new Set<Listener>();
let detach: (() => void) | null = null;
let upright = new UprightTracker();
let last: Gravity | null = null;
/** Bumped by every start and stop, so a start still waiting on the iOS prompt can tell it was cancelled. */
let generation = 0;
/** performance.now() of the newest motion reading: a suspended stream keeps `live` but stops ticking. */
let lastSampleAt = -Infinity;

/**
 * The last confident axis sign. It is learned only from the Start tap (player reading the
 * screen) and survives reloads; a weak reading never overwrites it.
 */
let sign: 1 | -1 = load<number>('forehead:axisSign', 1) === -1 ? -1 : 1;

const SIGN_SAMPLE_MS = 400;
/**
 * m/s²: how much gravity may wander over the sign window (its standard deviation, all axes
 * together): a hand or the tap's jolt stays under it, a swing toward the forehead does not.
 */
const SIGN_STEADY = 2;
/** m/s²: the page's top must be raised at least this much, and nothing may point further wrong. */
const SIGN_TOP = 2;
const SIGN_AGAINST = 2;
/** m/s²: the page's top tipped sideways past this (about 30°) is not a reading pose. */
const SIGN_SIDEWAYS = 5;
/** m/s²: gravity's size while the phone is held still; outside it the phone is being moved. */
const STILL_G: [number, number] = [7, 12.5];

/**
 * The axis sign from the Start tap's readings (page frame), or null unless they fit the pose the
 * check assumes: a player reading the screen, so page top raised (y > 0), screen not facing
 * away (z not below 0), top not tipped sideways, phone held still. A phone flat or screen-down,
 * or swung toward a forehead after a late permission grant, fits neither sign and gives null.
 */
function readingSign(mean: Gravity, spread: number): 1 | -1 | null {
  const s = axisSignFromLookingAt(mean, 0);
  if (s == null || spread > SIGN_STEADY) return null;
  const [x, y, z] = mean;
  const g = Math.hypot(x, y, z);
  const pose = s * y >= SIGN_TOP && s * z >= -SIGN_AGAINST && Math.abs(x) <= SIGN_SIDEWAYS;
  return pose && g >= STILL_G[0] && g <= STILL_G[1] ? s : null;
}

/** Page-frame gravity over the first SIGN_SAMPLE_MS of a stream: its mean and how much it wandered. */
class SignWindow {
  private from: number | null = null;
  private n = 0;
  private sum: Gravity = [0, 0, 0];
  private squares = 0;

  /** Adds a reading; true once the window is full. */
  add(p: Gravity, t: number): boolean {
    this.from ??= t;
    this.n++;
    for (let i = 0; i < 3; i++) this.sum[i] += p[i];
    this.squares += p[0] * p[0] + p[1] * p[1] + p[2] * p[2];
    return t - this.from >= SIGN_SAMPLE_MS;
  }

  sign(): 1 | -1 | null {
    const mean = this.sum.map((v) => v / this.n) as Gravity;
    const variance = this.squares / this.n - (mean[0] ** 2 + mean[1] ** 2 + mean[2] ** 2);
    return readingSign(mean, Math.sqrt(Math.max(0, variance)));
  }
}

function learnSign(w: SignWindow): void {
  const learned = w.sign();
  if (learned != null && learned !== sign) {
    sign = learned;
    save('forehead:axisSign', sign);
  }
}

/** The gyroscope layout this phone's browser was found to use; it survives reloads. */
function savedLayout(): GyroLayout | null {
  const l = load<GyroLayout | null>('forehead:gyroLayout', null);
  return GYRO_LAYOUTS.find((x) => x.map === l?.map && x.sign === l?.sign) ?? likelyLayout(navigator.userAgent);
}
let tracker = new PitchTracker(savedLayout());

/** The axis sign the gravity stream is multiplied by (the Tilt lab records it). */
export function axisSign(): 1 | -1 {
  return sign;
}

function onAngle() { motion.angle = screenAngle(); }

function unhook(): void {
  detach?.();
  detach = null;
  removeEventListener('orientationchange', onAngle);
  screen.orientation?.removeEventListener?.('change', onAngle);
}

/**
 * Must be the first thing a tap handler calls (iOS asks for permission there). `learnAxis`
 * only from the Start tap, when the player is looking at the screen; a Resume or a tap on the
 * get-ready screen may come with the phone already on a forehead. Resolves false without motion.
 */
export async function startMotion(learnAxis = false): Promise<boolean> {
  const mine = ++generation;
  const allowed = await requestMotion();
  if (mine !== generation) return false; // released while the prompt was up
  motion.denied = !allowed;
  if (!allowed) return false;
  unhook();
  motion.live = false;
  onAngle();
  addEventListener('orientationchange', onAngle);
  screen.orientation?.addEventListener?.('change', onAngle);
  upright = new UprightTracker();
  tracker = new PitchTracker(tracker.layout);
  let signWindow = learnAxis ? new SignWindow() : null;
  detach = watchMotion((s) => {
    const raw = s.g;
    const t = s.t;
    lastSampleAt = performance.now();
    if (signWindow?.add(toScreen(raw, screenAngle()), t)) {
      learnSign(signWindow);
      signWindow = null;
    }
    const g: Gravity = [raw[0] * sign, raw[1] * sign, raw[2] * sign];
    const lin = s.lin && ([s.lin[0] * sign, s.lin[1] * sign, s.lin[2] * sign] as Gravity);
    last = g;
    if (!motion.live) motion.live = true;
    const edge = upright.update(g, t);
    if (edge !== motion.edge) motion.edge = edge;
    const known = tracker.layout;
    tracker.update({ ...s, g, lin } satisfies MotionSample);
    if (tracker.layout !== known) save('forehead:gyroLayout', tracker.layout);
    const gyro = !s.rot ? 'none' : tracker.layout ? 'learned' : 'learning';
    if (gyro !== motion.gyro) motion.gyro = gyro;
    const p = { pitch: tracker.pitch, rate: tracker.rate };
    for (const fn of listeners) fn(g, t, p);
  });
  return true;
}

export function stopMotion(): void {
  generation++;
  unhook();
  motion.live = false;
}

/** One screen's use of the motion stream: `release` stops it only if no later start or stop has taken it over. */
export interface MotionClaim { ready: Promise<boolean>; release: () => void }

/** startMotion for a screen that may close or restart while the iOS prompt is up. */
export function claimMotion(learnAxis = false): MotionClaim {
  const ready = startMotion(learnAxis);
  const mine = generation; // startMotion bumps it before its first await
  return { ready, release: () => { if (generation === mine) stopMotion(); } };
}

/** True when readings are still arriving: the browser stops them, without a word, in the background. */
export function motionFresh(ms = 1000): boolean {
  return motion.live && performance.now() - lastSampleAt < ms;
}

export function onGravity(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * The holder's resting pitch, caught while the phone sat steady before the countdown; tilts
 * are scored relative to it. Null when the countdown started from a tap or after a reload.
 */
let restPitch: number | null = null;

export function setRestPitch(deg: number | null): void {
  restPitch = deg;
}

export function getRestPitch(): number | null {
  return restPitch;
}

/** Pins the upright edge to the phone's pose right now (the moment the countdown starts). */
export function pinUpright(): void {
  const e = last ? upEdge(last) : null;
  if (e != null) {
    upright.edge = e;
    motion.edge = e;
  }
}

const coarse = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** Bumped by every enter and exit, so a fullscreen request that resolves late can tell it is stale. */
let playGeneration = 0;
let playing = false;

const lockLandscape = () => (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.('landscape');
const leaveFullscreen = () => { if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); };

/**
 * Android: fullscreen, then lock landscape. iPhone has neither; every step is optional. If the
 * player left while fullscreen was still being granted, it is undone instead of locking the next
 * screen to landscape (a newer play session does its own lock).
 */
export function enterPlayMode(): void {
  const mine = ++playGeneration;
  playing = true;
  const el = document.documentElement;
  if (!coarse() || document.fullscreenElement || typeof el.requestFullscreen !== 'function') return;
  el.requestFullscreen({ navigationUI: 'hide' })
    .then(() => (mine === playGeneration ? lockLandscape() : playing ? undefined : leaveFullscreen()))
    .catch(() => { /* not allowed here: play on in whatever orientation the page has */ });
}

export function exitPlayMode(): void {
  playGeneration++;
  playing = false;
  try { screen.orientation?.unlock?.(); } catch { /* ignore */ }
  leaveFullscreen();
}
