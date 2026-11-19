// Device glue for the forehead game: one gravity stream started in the Start tap, the axis
// sign fix learned while the player is still looking at the Start screen, the upright edge for the
// people facing the phone, and Android's fullscreen + landscape lock.
import {
  requestMotion, watchGravity, screenAngle, toScreen, axisSignFromLookingAt, rotationFor,
  upEdge, UprightTracker, type Gravity,
} from '../../lib/motion';
import { load, save } from '../../lib/storage';

export const motion = $state({ live: false, denied: false, angle: screenAngle() as number, edge: 0 as 0 | 90 | 180 | 270 });

/** CSS rotation for the play screen so it reads upright for the viewers. */
export function stageRotation(): 0 | 90 | -90 | 180 {
  return motion.live ? rotationFor(motion.edge, motion.angle) : 0;
}

type Listener = (g: Gravity, t: number) => void;
const listeners = new Set<Listener>();
let detach: (() => void) | null = null;
let tracker = new UprightTracker();
let last: Gravity | null = null;
/** Bumped by every start and stop, so a start still waiting on the iOS prompt can tell it was cancelled. */
let generation = 0;

/**
 * The last confident axis sign. It is learned only from the Start tap (player reading the
 * screen) and survives reloads; a weak reading never overwrites it.
 */
let sign: 1 | -1 = load<number>('forehead:axisSign', 1) === -1 ? -1 : 1;

const SIGN_SAMPLE_MS = 400;

function onAngle() { motion.angle = screenAngle(); }

function unhook(): void {
  detach?.();
  detach = null;
  removeEventListener('orientationchange', onAngle);
  screen.orientation?.removeEventListener?.('change', onAngle);
}

/**
 * Must be the first thing a tap handler calls (iOS asks for permission there). `learnSign`
 * only from the Start tap, when the player is looking at the screen; a Resume or a tap on the
 * get-ready screen may come with the phone already on a forehead. Resolves false without motion.
 */
export async function startMotion(learnSign = false): Promise<boolean> {
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
  tracker = new UprightTracker();
  let firstAt: number | null = null;
  let deciding = learnSign;
  let n = 0;
  const sum: Gravity = [0, 0, 0];
  detach = watchGravity((raw, t) => {
    if (deciding) {
      firstAt ??= t;
      const p = toScreen(raw, screenAngle());
      sum[0] += p[0]; sum[1] += p[1]; sum[2] += p[2]; n++;
      if (t - firstAt >= SIGN_SAMPLE_MS) {
        deciding = false;
        const learned = axisSignFromLookingAt([sum[0] / n, sum[1] / n, sum[2] / n], 0);
        if (learned != null && learned !== sign) {
          sign = learned;
          save('forehead:axisSign', sign);
        }
      }
    }
    const g: Gravity = [raw[0] * sign, raw[1] * sign, raw[2] * sign];
    last = g;
    if (!motion.live) motion.live = true;
    const edge = tracker.update(g, t);
    if (edge !== motion.edge) motion.edge = edge;
    for (const fn of listeners) fn(g, t);
  });
  return true;
}

export function stopMotion(): void {
  generation++;
  unhook();
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
    tracker.edge = e;
    motion.edge = e;
  }
}

const coarse = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** Android: fullscreen, then lock landscape. iPhone has neither; every step is optional. */
export function enterPlayMode(): void {
  const el = document.documentElement;
  if (!coarse() || document.fullscreenElement || typeof el.requestFullscreen !== 'function') return;
  el.requestFullscreen({ navigationUI: 'hide' })
    .then(() => (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })?.lock?.('landscape'))
    .catch(() => { /* not allowed here: play on in whatever orientation the page has */ });
}

export function exitPlayMode(): void {
  try { screen.orientation?.unlock?.(); } catch { /* ignore */ }
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
}
