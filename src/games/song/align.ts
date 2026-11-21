// Finds where Apple's 30-second preview sits inside a song's full recording, so a clip cut from
// the full recording (scripts/clip-songs.mjs) starts on the moment the game would play from the
// preview. Both come in as mono samples at one low rate; the preview's middle (its fades left
// out) is slid along the song by normalised cross-correlation, done with an FFT. Pure, with no
// runtime imports: Node runs this file directly for the script, and the tests drive it with
// synthetic signals.

/** A match this strong (normalised correlation, −1 to 1) is the same recording; noise gives about 0.01. */
export const CONFIDENT = 0.4;
/** A weaker match still counts when it stands this far above every other offset (a remaster, another mix). */
export const WEAK = 0.2;
export const CLEAR = 2.5;
/** Apple fades previews in and out; this much of each end is left out of the match. */
export const TRIM_S = 2;

export interface Alignment {
  /** Seconds into the song where the preview's first sample is. */
  offset: number;
  /** Normalised correlation at the best offset. */
  score: number;
  /** The best score more than a second away from it (a repeated chorus scores high too). */
  runnerUp: number;
  confident: boolean;
}

/** In-place radix-2 FFT of (re, im); `inverse` gives the unscaled inverse. Length must be a power of two. */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}

const NOT_FOUND: Alignment = { offset: 0, score: 0, runnerUp: 0, confident: false };

/** Where `preview` best fits inside `song` (both mono at `rate`), and whether that is a sure match. */
export function alignPreview(song: Float32Array, preview: Float32Array, rate: number): Alignment {
  const trim = Math.round(TRIM_S * rate);
  const from = Math.min(trim, preview.length >> 2);
  const tpl = preview.subarray(from, Math.max(preview.length - trim, (preview.length * 3) >> 2));
  const m = tpl.length;
  const n = song.length;
  if (m < rate || n < m) return NOT_FOUND;
  // The template, zero-mean, so the song window's own mean drops out of the product.
  let mean = 0;
  for (let i = 0; i < m; i++) mean += tpl[i];
  mean /= m;
  let size = 1;
  while (size < n + m) size <<= 1;
  const ar = new Float64Array(size);
  const ai = new Float64Array(size);
  const br = new Float64Array(size);
  const bi = new Float64Array(size);
  let tplNorm = 0;
  for (let i = 0; i < m; i++) { const v = tpl[i] - mean; br[i] = v; tplNorm += v * v; }
  for (let i = 0; i < n; i++) ar[i] = song[i];
  if (tplNorm === 0) return NOT_FOUND;
  fft(ar, ai);
  fft(br, bi);
  // song ⋆ template: FFT(song) · conj(FFT(template)).
  for (let i = 0; i < size; i++) {
    const r = ar[i] * br[i] + ai[i] * bi[i];
    const im = ai[i] * br[i] - ar[i] * bi[i];
    ar[i] = r;
    ai[i] = im;
  }
  fft(ar, ai, true);
  // Each window's energy about its own mean, from running sums.
  const sum = new Float64Array(n + 1);
  const sq = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) { sum[i + 1] = sum[i] + song[i]; sq[i + 1] = sq[i] + song[i] * song[i]; }
  const lags = n - m + 1;
  const ncc = new Float32Array(lags);
  const floor = 1e-9 * m;
  let best = 0;
  for (let k = 0; k < lags; k++) {
    const s = sum[k + m] - sum[k];
    const e = sq[k + m] - sq[k] - (s * s) / m;
    ncc[k] = e > floor ? ar[k] / size / Math.sqrt(e * tplNorm) : 0;
    if (ncc[k] > ncc[best]) best = k;
  }
  let runnerUp = 0;
  for (let k = 0; k < lags; k++) if (Math.abs(k - best) > rate && ncc[k] > runnerUp) runnerUp = ncc[k];
  const score = ncc[best];
  const confident = score >= CONFIDENT || (score >= WEAK && score >= CLEAR * runnerUp);
  return { offset: (best - from) / rate, score, runnerUp, confident };
}
