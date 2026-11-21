import { describe, expect, it } from 'vitest';
import { alignPreview, fft } from './align';

const RATE = 1000;

/** Deterministic noise in −1…1. */
function noise(n: number, seed: number): Float32Array {
  const out = new Float32Array(n);
  let x = seed >>> 0;
  for (let i = 0; i < n; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    out[i] = x / 2 ** 31 - 1;
  }
  return out;
}

describe('Earworm preview alignment', () => {
  it('fft and its inverse give the signal back', () => {
    const re = Float64Array.from([1, 2, 3, 4, 0, -1, 0.5, 2]);
    const im = new Float64Array(8);
    fft(re, im);
    fft(re, im, true);
    expect([...re].map((v) => Math.round((v / 8) * 1e6) / 1e6)).toEqual([1, 2, 3, 4, 0, -1, 0.5, 2]);
  });

  it('finds a known offset, even with the preview quieter, faded and noisier', () => {
    const song = noise(120 * RATE, 7);
    const at = 47.25;
    const preview = song.slice(at * RATE, (at + 30) * RATE).map((v, i) => {
      const fade = Math.min(1, i / (1.5 * RATE), (30 * RATE - i) / (1.5 * RATE));
      return 0.5 * v * fade;
    });
    const extra = noise(preview.length, 99);
    const noisy = preview.map((v, i) => v + 0.2 * extra[i]);
    const a = alignPreview(song, noisy, RATE);
    expect(a.confident).toBe(true);
    expect(a.offset).toBeCloseTo(at, 2);
    expect(a.score).toBeGreaterThan(0.8);
  });

  it('says it is not sure when the preview is not in the song', () => {
    const a = alignPreview(noise(120 * RATE, 7), noise(30 * RATE, 12345), RATE);
    expect(a.confident).toBe(false);
    expect(a.score).toBeLessThan(0.1);
  });

  it('is not sure when the song is shorter than the preview, or silent', () => {
    expect(alignPreview(noise(10 * RATE, 1), noise(30 * RATE, 2), RATE).confident).toBe(false);
    expect(alignPreview(new Float32Array(60 * RATE), new Float32Array(30 * RATE), RATE).confident).toBe(false);
  });
});

describe('Earworm preview alignment, weaker matches', () => {
  it('trusts a weaker match only when it stands well clear of every other offset', () => {
    const song = noise(90 * RATE, 3);
    const other = noise(30 * RATE, 4);
    // Another mix: a quarter of the song's own sound under three quarters of something else.
    const preview = song.slice(20 * RATE, 50 * RATE).map((v, i) => 0.25 * v + 0.75 * other[i]);
    const a = alignPreview(song, preview, RATE);
    expect(a.score).toBeLessThan(0.4);
    expect(a.score).toBeGreaterThan(0.2);
    expect(a.offset).toBeCloseTo(20, 2);
    expect(a.confident).toBe(true);
  });
});
