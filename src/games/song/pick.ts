// Picks the clip's start in a 30-second preview: the beginning of the loudest, most energetic
// stretch (usually the chorus or the drop), starting in a breath rather than mid-word.
// Pure: it reads decoded mono samples, so the tests drive it with synthetic signals.

/** Analysis frame: loudness is measured every 50 ms. */
export const HOP_S = 0.05;
/** Apple fades previews in and out over about this long; those stretches never count. */
export const FADE_S = 1.5;
/** The clip may start from here… */
export const EARLIEST_S = 1.5;
/** …to here, so the longest clip (10 s) still ends well inside the preview. */
export const LATEST_S = 20;
/** The longest clip, which must fit between the start and the end of the preview. */
export const LONGEST_S = 10;
/** Bump when the picker changes, so starts cached on phones are worked out again. */
export const PICK_VERSION = 1;

const FLOOR_DB = -60;
/** "Sustained": the mean loudness over the next 5 s. */
const SUSTAIN_S = 5;
/** A rise compares the second after the start with the 1.5 s before it. */
const AFTER_S = 1;
const BEFORE_S = 1.5;
/** How far before the best moment the start may move to land in a breath. */
const SNAP_BACK_S = 0.3;

export interface Analysis {
  /** Loudness per frame in dB, 0 at the loudest frame, never below FLOOR_DB. */
  loud: Float32Array;
  /** Onset strength per frame, 0–1: how sharply the bright part of the sound jumps. */
  onset: Float32Array;
  rate: number;
  duration: number;
}

const db = (x: number) => Math.max(FLOOR_DB, 20 * Math.log10(x + 1e-9));

/** Loudness and onset strength per 50 ms frame. */
export function analyse(samples: Float32Array, rate: number): Analysis {
  const hop = Math.max(1, Math.round(rate * HOP_S));
  const n = Math.floor(samples.length / hop);
  const loud = new Float32Array(n);
  const bright = new Float32Array(n);
  let prev = 0;
  for (let f = 0; f < n; f++) {
    let e = 0, h = 0;
    for (let i = f * hop, end = i + hop; i < end; i++) {
      const x = samples[i];
      const d = x - prev;
      prev = x;
      e += x * x;
      h += d * d;
    }
    loud[f] = db(Math.sqrt(e / hop));
    bright[f] = db(Math.sqrt(h / hop));
  }
  const top = loud.reduce((m, x) => Math.max(m, x), FLOOR_DB);
  for (let f = 0; f < n; f++) loud[f] = Math.max(FLOOR_DB, loud[f] - top);
  const onset = new Float32Array(n);
  let peak = 0;
  for (let f = 1; f < n; f++) {
    onset[f] = Math.max(0, bright[f] - bright[f - 1]) + 0.5 * Math.max(0, loud[f] - loud[f - 1]);
    peak = Math.max(peak, onset[f]);
  }
  if (peak > 0) for (let f = 0; f < n; f++) onset[f] /= peak;
  return { loud, onset, rate, duration: samples.length / rate };
}

function mean(a: Float32Array, from: number, to: number): number | null {
  const s = Math.max(0, from), e = Math.min(a.length, to);
  if (e <= s) return null;
  let t = 0;
  for (let i = s; i < e; i++) t += a[i];
  return t / (e - s);
}

/** The latest start that keeps the longest clip inside the preview. */
export const latestStart = (duration: number) => Math.max(0, Math.min(LATEST_S, duration - LONGEST_S));

/** How good a start each frame would be (higher is better); -Infinity outside the allowed range. */
export function scores(a: Analysis): Float32Array {
  const { loud, onset } = a;
  const fr = (s: number) => Math.round(s / HOP_S);
  const out = new Float32Array(loud.length).fill(-Infinity);
  const first = fr(EARLIEST_S), last = Math.min(fr(latestStart(a.duration)), loud.length - 1);
  const fadeIn = fr(FADE_S), fadeOut = loud.length - fr(FADE_S);
  for (let i = first; i <= last; i++) {
    const sustained = mean(loud, i, Math.min(i + fr(SUSTAIN_S), fadeOut)) ?? FLOOR_DB;
    // The stretch before only counts outside the fade-in, and only if there is half a second of it.
    const from = Math.max(fadeIn, i - fr(BEFORE_S));
    const before = i - from >= fr(0.5) ? mean(loud, from, i) : null;
    const after = mean(loud, i, i + fr(AFTER_S)) ?? FLOOR_DB;
    const rise = before === null ? 0 : Math.max(0, after - before);
    let hit = 0;
    for (let j = i - 1; j <= i + 2; j++) hit = Math.max(hit, onset[j] ?? 0);
    out[i] = sustained + 0.6 * rise + 4 * hit;
  }
  return out;
}

/** Seconds into the preview where the clip should start. */
export function pickStart(samples: Float32Array, rate: number): number {
  const a = analyse(samples, rate);
  const s = scores(a);
  let best = -1;
  for (let i = 0; i < s.length; i++) if (s[i] > -Infinity && (best < 0 || s[i] > s[best])) best = i;
  if (best < 0) return Math.min(EARLIEST_S, latestStart(a.duration));
  return breathBefore(samples, rate, best * HOP_S);
}

/**
 * The quietest 10 ms in the 300 ms up to `at` (and 30 ms after), so the clip opens in a breath
 * or between beats instead of in the middle of a word. Never earlier than EARLIEST_S.
 */
export function breathBefore(samples: Float32Array, rate: number, at: number): number {
  const win = Math.max(1, Math.round(rate * 0.01));
  const from = Math.max(Math.round(EARLIEST_S * rate), Math.round((at - SNAP_BACK_S) * rate));
  const to = Math.min(samples.length - win, Math.round((at + 0.03) * rate));
  let bestAt = Math.round(at * rate), bestE = Infinity;
  for (let i = from; i <= to; i += win) {
    let e = 0;
    for (let k = i; k < i + win; k++) e += samples[k] * samples[k];
    // Ties go to the later spot, closest to the rise.
    if (e <= bestE * 1.0001) { bestE = e; bestAt = i; }
  }
  return Math.round((bestAt / rate) * 100) / 100;
}

/** The preview's loudness as `count` bars of 0–1, for the start picker in the song editor. */
export function loudnessBars(a: Analysis, count: number): number[] {
  const per = a.loud.length / count;
  return Array.from({ length: count }, (_, b) => {
    const m = mean(a.loud, Math.floor(b * per), Math.max(Math.floor(b * per) + 1, Math.floor((b + 1) * per))) ?? FLOOR_DB;
    return Math.max(0.04, 1 + m / 40);
  });
}

/** Mono samples from a decoded buffer's channels (their average). */
export function mixDown(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const out = new Float32Array(channels[0].length);
  for (const c of channels) for (let i = 0; i < out.length; i++) out[i] += c[i] / channels.length;
  return out;
}

/** A start kept inside the preview, so the longest clip still fits. */
export const fitStart = (start: number, duration: number) => Math.min(Math.max(0, start), latestStart(duration));
