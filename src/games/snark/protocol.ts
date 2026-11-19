// Messages between the host screen and the phones (JSON over a WebRTC data channel).
import type { PlayerView } from './view';

export type ToHost =
  | { t: 'hello'; pid: string; name: string }
  | { t: 'answer'; i: number; text: string }
  | { t: 'vote'; c: 'a' | 'b' }
  | { t: 'votes'; v: Record<string, number> }
  | { t: 'pong' };

export type ToPhone =
  | { t: 'welcome'; pid: string }
  | { t: 'view'; v: PlayerView }
  | { t: 'reject'; why: string }
  | { t: 'ended' }
  | { t: 'ping' };

const str = (x: unknown, max: number): x is string => typeof x === 'string' && x.length <= max;

/** Phones are other people's devices: anything that is not a well-formed message is dropped. */
export function readToHost(x: unknown): ToHost | null {
  if (!x || typeof x !== 'object') return null;
  const m = x as Record<string, unknown>;
  switch (m.t) {
    case 'hello': return str(m.pid, 64) && str(m.name, 200) ? { t: 'hello', pid: m.pid, name: m.name } : null;
    case 'answer': return Number.isInteger(m.i) && str(m.text, 1000) ? { t: 'answer', i: m.i as number, text: m.text } : null;
    case 'vote': return m.c === 'a' || m.c === 'b' ? { t: 'vote', c: m.c } : null;
    case 'votes': {
      if (!m.v || typeof m.v !== 'object') return null;
      const v = Object.fromEntries(Object.entries(m.v as object).filter(([, n]) => Number.isInteger(n)));
      return { t: 'votes', v };
    }
    case 'pong': return { t: 'pong' };
    default: return null;
  }
}
