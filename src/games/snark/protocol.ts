// Messages between the host screen and the phones (JSON over a WebRTC data channel).
import type { PlayerView } from './view';

// Answers and votes say what they are for (round `r`, prompt index `i` or `at`): a phone that
// was offline re-sends them later, and the host must not apply one to a prompt that moved on.
// `match`: the room's game it is for, from the view (pages and hosts from before it leave it out).
export type ToHost =
  | { t: 'hello'; pid: string; name: string }
  | { t: 'answer'; match?: number; r: number; i: number; text: string }
  /** Three-line duel: the player's lines (the host trims them and drops blanks). */
  | { t: 'lines'; match?: number; r: number; i: number; lines: string[] }
  | { t: 'vote'; match?: number; r: number; at: number; c: 'a' | 'b' }
  | { t: 'votes'; match?: number; r: number; at: number; v: Record<string, number> }
  | { t: 'pong' };

export type ToPhone =
  | { t: 'welcome'; pid: string }
  | { t: 'view'; v: PlayerView }
  | { t: 'reject'; why: string }
  | { t: 'ended' }
  | { t: 'ping' };

const str = (x: unknown, max: number): x is string => typeof x === 'string' && x.length <= max;
const int = (x: unknown): x is number => Number.isInteger(x);
const lineList = (x: unknown): x is string[] => Array.isArray(x) && x.length >= 1 && x.length <= 3 && x.every((l) => str(l, 200));

/** Phones are other people's devices: anything that is not a well-formed message is dropped. */
export function readToHost(x: unknown): ToHost | null {
  if (!x || typeof x !== 'object') return null;
  const m = x as Record<string, unknown>;
  const read = readShape(m);
  return read && int(m.match) ? ({ ...read, match: m.match } as ToHost) : read;
}

function readShape(m: Record<string, unknown>): ToHost | null {
  switch (m.t) {
    case 'hello': return str(m.pid, 64) && str(m.name, 200) ? { t: 'hello', pid: m.pid, name: m.name } : null;
    case 'answer': return int(m.r) && int(m.i) && str(m.text, 1000) ? { t: 'answer', r: m.r, i: m.i, text: m.text } : null;
    case 'lines': return int(m.r) && int(m.i) && lineList(m.lines) ? { t: 'lines', r: m.r, i: m.i, lines: [...m.lines] } : null;
    case 'vote': return int(m.r) && int(m.at) && (m.c === 'a' || m.c === 'b') ? { t: 'vote', r: m.r, at: m.at, c: m.c } : null;
    case 'votes': {
      if (!int(m.r) || !int(m.at) || !m.v || typeof m.v !== 'object') return null;
      const v = Object.fromEntries(Object.entries(m.v as object).filter(([, n]) => Number.isInteger(n)));
      return { t: 'votes', r: m.r, at: m.at, v };
    }
    case 'pong': return { t: 'pong' };
    default: return null;
  }
}
