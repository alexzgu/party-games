// Messages between Sketchy phones and the host, checked on arrival.
import { ERASER, INKS, MAX_POINTS, WIDTHS, readDrawing, type Drawing } from '../../lib/ink';
import { GUESS_MAX, LINE_MAX } from './core';
import type { Delta } from './live';

/** Messages kept and re-sent after a reconnect until a view shows they arrived. */
export type Action =
  | { t: 'line'; at: number; text: string }
  | { t: 'draw'; at: number; d: Drawing }
  | { t: 'pick'; at: number; i: number };
/** Live ink: added strokes (`Delta`), or the whole drawing (`all`), numbered from 1 each turn. */
export type Ink = { t: 'ink'; at: number; n: number } & (Delta | { all: Drawing });
export type ToHost = Action | Ink | { t: 'guess'; at: number; text: string } | { t: 'art?'; id: string };

/** Drawings over this many bytes of JSON are turned away. */
export const MAX_BYTES = 200_000;
/** A drawing from a phone: the palette and the eraser, which only comes as the thick pen. */
export function ink(raw: unknown): Drawing | null {
  const d = readDrawing(raw, INKS.length);
  return d && d.every((s) => s.c !== ERASER || s.w === WIDTHS[1]) ? d : null;
}
const id = (x: unknown): x is string => typeof x === 'string' && x.length <= 100;
const count = (x: unknown, max: number): x is number => Number.isSafeInteger(x) && (x as number) >= 0 && (x as number) <= max;
const bytes = (m: unknown) => new TextEncoder().encode(JSON.stringify(m)).length;

/** A delta's strokes, shape only (its first may be half a stroke): whoever applies one checks the drawing it makes. */
function strokes(raw: unknown): Drawing | null {
  if (!Array.isArray(raw) || raw.length > MAX_POINTS) return null;
  const ok = raw.every((s) => s && Number.isInteger(s.c) && Number.isInteger(s.w) && Array.isArray(s.p) &&
    s.p.length % 2 === 0 && s.p.length <= 2 * MAX_POINTS && s.p.every(Number.isInteger));
  return ok ? raw.map(({ c, w, p }) => ({ c, w, p })) : null;
}

function readInk(m: Record<string, unknown>, at: number): Ink | null {
  if (!count(m.n, 1e9) || m.n < 1) return null;
  if ('all' in m) {
    const all = ink(m.all);
    return all ? { t: 'ink', at, n: m.n, all } : null;
  }
  const d = strokes(m.d);
  return d && count(m.i, 6000) && count(m.o, 12000) ? { t: 'ink', at, n: m.n, i: m.i, o: m.o, d } : null;
}

export function readToHost(raw: unknown): ToHost | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (m.t === 'art?') return id(m.id) ? { t: m.t, id: m.id } : null;
  const at = m.at;
  if (typeof at !== 'number' || !Number.isSafeInteger(at) || at < 1) return null;
  if (m.t === 'line' && typeof m.text === 'string' && m.text.length <= LINE_MAX) return { t: m.t, at, text: m.text };
  if (m.t === 'guess' && typeof m.text === 'string' && m.text.length <= GUESS_MAX) return { t: m.t, at, text: m.text };
  if (m.t === 'pick' && count(m.i, 2)) return { t: m.t, at, i: m.i };
  if (bytes(m) > MAX_BYTES) return null;
  if (m.t === 'ink') return readInk(m, at);
  const d = m.t === 'draw' ? ink(m.d) : null;
  return d ? { t: 'draw', at, d } : null;
}

/** From the host: a whole drawing (`n` set while it is being drawn live). */
export function readArt(raw: { t: string; id?: unknown; d?: unknown; n?: unknown }) {
  if (raw.t !== 'art' || !id(raw.id)) return null;
  const d = ink(raw.d);
  return d ? { id: raw.id, d, n: count(raw.n, 1e9) ? raw.n : undefined } : null;
}

/** From the host: live ink added to the drawing being drawn. */
export function readLive(raw: { t: string; id?: unknown; n?: unknown; i?: unknown; o?: unknown; d?: unknown }) {
  if (raw.t !== 'ink' || !id(raw.id) || !count(raw.n, 1e9) || !count(raw.i, 6000) || !count(raw.o, 12000)) return null;
  const d = strokes(raw.d);
  return d ? { id: raw.id, n: raw.n, delta: { i: raw.i, o: raw.o, d } as Delta } : null;
}
