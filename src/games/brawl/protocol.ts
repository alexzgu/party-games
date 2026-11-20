import { readDrawing, type Drawing } from './ink';
import type { Side } from './logic';

export type Action =
  | { t: 'draw'; at: number; name: string; d: Drawing }
  | { t: 'vote'; at: number; side: Side }
  | { t: 'tag'; at: number; id: string };
export type ToHost = Action | { t: 'art?'; id: string };

const id = (x: unknown): x is string => typeof x === 'string' && x.length <= 100;
export function readToHost(raw: unknown): ToHost | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (m.t === 'art?' && id(m.id)) return { t: m.t, id: m.id };
  const at = m.at;
  if (typeof at !== 'number' || !Number.isSafeInteger(at) || at < 1) return null;
  if (m.t === 'vote' && (m.side === 0 || m.side === 1)) return { t: m.t, at, side: m.side };
  if (m.t === 'tag' && id(m.id)) return { t: m.t, at, id: m.id };
  if (m.t !== 'draw' || typeof m.name !== 'string' || m.name.length > 30) return null;
  if (new TextEncoder().encode(JSON.stringify(m)).length > 200_000) return null;
  const d = readDrawing(m.d);
  return d?.length ? { t: m.t, at, name: m.name, d } : null;
}

export function readArt(raw: { t: string; id?: unknown; d?: unknown }) {
  if (raw.t !== 'art' || !id(raw.id)) return null;
  const d = readDrawing(raw.d);
  return d ? { id: raw.id, d } : null;
}
