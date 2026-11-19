import { describe, expect, it } from 'vitest';
import { analyse, fitStart, latestStart, loudnessBars, mixDown, pickStart, EARLIEST_S, LATEST_S, LONGEST_S } from './pick';

const RATE = 8000;
const LEN = 30;

/** A 30 s synthetic preview: `amp(t)` sets the loudness envelope over a tone plus a little noise. */
function signal(amp: (t: number) => number, seconds = LEN): Float32Array {
  const out = new Float32Array(seconds * RATE);
  let seed = 7;
  for (let i = 0; i < out.length; i++) {
    const t = i / RATE;
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const noise = seed / 0x7fffffff - 0.5;
    out[i] = amp(t) * (0.8 * Math.sin(2 * Math.PI * 220 * t) + 0.4 * noise);
  }
  return out;
}

/** Apple's previews fade in and out over the first and last second and a half. */
const faded = (amp: (t: number) => number) => (t: number) => amp(t) * Math.min(1, t / 1.5, (LEN - t) / 1.5);

/** Sung syllables: 180 ms on, 70 ms breath, starting at `from`, over a steady backing. */
const SYL = 0.25, ON = 0.18;
const sung = (from: number, backing: number) => (t: number) => {
  if (t < from) return 0.06;
  const inSyllable = (t - from) % SYL < ON;
  return backing + (inSyllable ? 0.55 : 0);
};

describe('clip picker', () => {
  it('starts where a quiet verse turns into a loud chorus', () => {
    const s = pickStart(signal(faded((t) => (t < 12 ? 0.08 : 0.7))), RATE);
    expect(s).toBeGreaterThanOrEqual(11.6);
    expect(s).toBeLessThanOrEqual(12.05);
  });

  it('prefers the sustained loud stretch to a single loud hit in a quiet part', () => {
    // One very loud 40 ms hit at 5 s; the chorus starts at 16 s.
    const s = pickStart(signal(faded((t) => (t > 5 && t < 5.04 ? 1 : t < 16 ? 0.1 : 0.6))), RATE);
    expect(s).toBeGreaterThanOrEqual(15.6);
    expect(s).toBeLessThanOrEqual(16.05);
  });

  it('ignores the fade-in and fade-out and keeps the longest clip inside the preview', () => {
    // Loud only during the fade-in, then quiet: the fade-in edge must not count as a rise.
    const early = pickStart(signal((t) => (t < 1.4 ? 0.9 : 0.2)), RATE);
    expect(early).toBeGreaterThanOrEqual(EARLIEST_S);
    // Loud only in the last 8 s: the start may not go past 20 s.
    const late = pickStart(signal(faded((t) => (t < 22 ? 0.1 : 0.8))), RATE);
    expect(late).toBeLessThanOrEqual(LATEST_S);
    expect(late + LONGEST_S).toBeLessThanOrEqual(LEN);
    expect(late).toBeGreaterThan(15);
    // Evenly loud all the way: anywhere allowed is fine, but inside the range.
    const flat = pickStart(signal(faded(() => 0.5)), RATE);
    expect(flat).toBeGreaterThanOrEqual(EARLIEST_S);
    expect(flat).toBeLessThanOrEqual(LATEST_S);
  });

  it('starts in a breath, not in the middle of a word, even with a loud hit mid-word', () => {
    const env = sung(10, 0.2);
    // A drum hit lands in the middle of a syllable a few beats in.
    const withHit = (t: number) => (t > 10.6 && t < 10.63 ? 1 : env(t));
    const s = pickStart(signal(faded(withHit)), RATE);
    expect(s).toBeGreaterThan(9.6);
    expect(s).toBeLessThan(11);
    // Before the first syllable, or in a breath between syllables (with 20 ms slack), never inside one.
    const phase = (s - 10) % SYL;
    const inside = s >= 10 && phase > 0.02 && phase < ON - 0.005;
    expect(inside, `start ${s}`).toBe(false);
  });

  it('handles short or silent previews', () => {
    expect(pickStart(new Float32Array(RATE * 8), RATE)).toBe(0);
    const silent = pickStart(new Float32Array(RATE * LEN), RATE);
    expect(silent).toBeGreaterThanOrEqual(EARLIEST_S);
    expect(silent).toBeLessThanOrEqual(LATEST_S);
  });

  it('gives loudness bars, mixes channels and keeps starts in range', () => {
    const bars = loudnessBars(analyse(signal((t) => (t < 15 ? 0.05 : 0.8)), RATE), 30);
    expect(bars).toHaveLength(30);
    expect(bars[5]).toBeLessThan(bars[25]);
    expect(Math.max(...bars)).toBeLessThanOrEqual(1);
    expect(Array.from(mixDown([new Float32Array([1, 0]), new Float32Array([0, 1])]))).toEqual([0.5, 0.5]);
    expect(latestStart(31)).toBe(LATEST_S);
    expect(latestStart(29.5)).toBe(19.5);
    expect(fitStart(25, 31)).toBe(LATEST_S);
    expect(fitStart(-1, 30)).toBe(0);
  });
});
