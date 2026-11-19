// Plays clips of Apple's 30-second previews through Web Audio. A preview is fetched and decoded
// once (Apple's preview files allow this from any site), so a clip starts on the exact second,
// replays instantly, and the clip picker can read the samples. iPhones only start sound inside
// a tap: call unlockMusic() in the tap that leads to sound.
import { unlockAudio } from '../../lib/sound';
import { loadAutoStart, saveAutoStart } from './store';
import { fitStart, mixDown, pickStart } from './pick';
import type { Song } from '../../lib/content';
import type { Track } from './match';

let ctx: AudioContext | null = null;

/** The music's audio context (made on first use; it may start suspended until a tap). */
export function music(): AudioContext {
  ctx ??= new AudioContext({ latencyHint: 'playback' });
  return ctx;
}

/** Call inside a tap: lets this page play sound (and through the iPhone's silent switch). */
export function unlockMusic(): void {
  unlockAudio();
  try {
    const c = music();
    if (c.state !== 'running') void c.resume();
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, 22050);
    src.connect(c.destination);
    src.start(0);
  } catch { /* no Web Audio: play() reports it */ }
}

const buffers = new Map<string, Promise<AudioBuffer>>();
const KEEP_BUFFERS = 6;

/** A preview, downloaded and decoded (kept in memory for the last few songs). */
export function loadPreview(url: string): Promise<AudioBuffer> {
  const hit = buffers.get(url);
  if (hit) {
    buffers.delete(url);
    buffers.set(url, hit);
    return hit;
  }
  const p = (async () => {
    let res: Response;
    try { res = await fetch(url); } catch { throw new Error('no answer'); }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return music().decodeAudioData(await res.arrayBuffer());
  })();
  buffers.set(url, p);
  p.catch(() => buffers.delete(url));
  while (buffers.size > KEEP_BUFFERS) buffers.delete(buffers.keys().next().value!);
  return p;
}

/** A song ready to play: its decoded preview and the second its clip starts at. */
export interface Prepared {
  apple: number;
  track: Track;
  buffer: AudioBuffer;
  start: number;
  /** True when the start was picked automatically (no `start` in the pack). */
  auto: boolean;
}

/** The start the picker chooses for a preview, worked out once per track and remembered. */
export function autoStart(id: number, buffer: AudioBuffer): number {
  const known = loadAutoStart(id);
  if (known !== null) return fitStart(known, buffer.duration);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  const start = pickStart(mixDown(channels), buffer.sampleRate);
  saveAutoStart(id, start);
  return start;
}

export async function prepare(song: Song, track: Track): Promise<Prepared> {
  const buffer = await loadPreview(track.preview);
  const auto = typeof song.start !== 'number';
  const start = auto ? autoStart(track.id, buffer) : fitStart(song.start!, buffer.duration);
  return { apple: track.id, track, buffer, start, auto };
}

export interface PlayHooks {
  /** Fraction heard so far, 0–1. */
  progress?(f: number): void;
  /** The clip played to its end (not called after stop()). */
  ended?(): void;
  /** The browser would not start the sound: it needs a tap. */
  blocked?(): void;
}

/** If the context is still not running this long after play, the sound needs a tap. */
export const BLOCKED_AFTER_MS = 1500;

/** Plays one clip at a time from a decoded preview, with a short fade so it never clicks. */
export class ClipPlayer {
  private src: AudioBufferSourceNode | null = null;
  private frame = 0;
  private run = 0;

  /** Plays `seconds` from `from`. Call it inside a tap the first time (iOS). */
  play(buffer: AudioBuffer, from: number, seconds: number, hooks: PlayHooks = {}): void {
    this.stop();
    const run = ++this.run;
    let c: AudioContext;
    try { c = music(); } catch { hooks.blocked?.(); return; }
    if (c.state !== 'running') void c.resume();
    const length = Math.max(0.1, Math.min(seconds, buffer.duration - from));
    const gain = c.createGain();
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.connect(gain).connect(c.destination);
    const t0 = c.currentTime + 0.03;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(1, t0 + 0.02);
    gain.gain.setValueAtTime(1, t0 + length - 0.06);
    gain.gain.linearRampToValueAtTime(0, t0 + length);
    src.onended = () => {
      if (run !== this.run) return;
      this.src = null;
      cancelAnimationFrame(this.frame);
      hooks.progress?.(1);
      hooks.ended?.();
    };
    src.start(t0, from, length);
    this.src = src;
    const askedAt = performance.now();
    let told = false;
    const tick = () => {
      if (run !== this.run) return;
      hooks.progress?.(Math.min(1, Math.max(0, (c.currentTime - t0) / length)));
      if (!told && c.state !== 'running' && performance.now() - askedAt > BLOCKED_AFTER_MS) { told = true; hooks.blocked?.(); }
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  get playing(): boolean { return !!this.src; }

  stop(): void {
    this.run++;
    cancelAnimationFrame(this.frame);
    const s = this.src;
    this.src = null;
    if (!s) return;
    s.onended = null;
    try { s.stop(); } catch { /* already stopped */ }
  }
}
