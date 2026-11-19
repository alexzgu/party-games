import { settings } from './settings.svelte';

// Synthesised cues: nothing to download, no decode delay, instant on first tap.
let ctx: AudioContext | null = null;

/** Call from a tap handler: iOS only lets audio start inside a user gesture. */
export function unlockAudio(): void {
  try {
    // Plays through the iPhone silent switch, like a game should (Safari 16.4+).
    const session = (navigator as any).audioSession;
    if (session && session.type !== 'playback') session.type = 'playback';
    ctx ??= new AudioContext();
    if (ctx.state !== 'running') void ctx.resume();
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    ctx = null;
  }
}

type Note = { f: number; t: number; d: number; type?: OscillatorType; g?: number; to?: number };

function play(notes: Note[]): void {
  if (!settings.sound || !ctx) return;
  if (ctx.state !== 'running') void ctx.resume();
  const now = ctx.currentTime + 0.01;
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = n.type ?? 'sine';
    osc.frequency.setValueAtTime(n.f, now + n.t);
    if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, now + n.t + n.d);
    const peak = n.g ?? 0.22;
    gain.gain.setValueAtTime(0.0001, now + n.t);
    gain.gain.exponentialRampToValueAtTime(peak, now + n.t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + n.t);
    osc.stop(now + n.t + n.d + 0.05);
  }
}

export const sfx = {
  tap: () => play([{ f: 660, t: 0, d: 0.05, type: 'triangle', g: 0.08 }]),
  tick: () => play([{ f: 880, t: 0, d: 0.06, type: 'square', g: 0.05 }]),
  count: () => play([{ f: 523, t: 0, d: 0.16, type: 'triangle', g: 0.25 }]),
  go: () => play([{ f: 784, t: 0, d: 0.3, type: 'triangle', g: 0.3 }, { f: 1046, t: 0, d: 0.3, type: 'sine', g: 0.15 }]),
  correct: () => play([{ f: 880, t: 0, d: 0.1, type: 'triangle' }, { f: 1318, t: 0.08, d: 0.22, type: 'triangle' }]),
  pass: () => play([{ f: 300, t: 0, d: 0.22, type: 'sawtooth', g: 0.1, to: 180 }]),
  reveal: () => play([{ f: 392, t: 0, d: 0.12, type: 'triangle' }, { f: 523, t: 0.1, d: 0.12, type: 'triangle' }, { f: 784, t: 0.2, d: 0.3, type: 'triangle' }]),
  win: () => play([523, 659, 784, 1046].map((f, i) => ({ f, t: i * 0.11, d: 0.35, type: 'triangle' as const }))),
  buzzer: () => play([{ f: 196, t: 0, d: 0.7, type: 'square', g: 0.14 }, { f: 185, t: 0, d: 0.7, type: 'sawtooth', g: 0.1 }]),
  warn: () => play([{ f: 1200, t: 0, d: 0.05, type: 'square', g: 0.06 }]),
};
