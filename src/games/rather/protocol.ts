// The one message a phone sends the host: a tap on a side. `at` ties it to the phase it was meant
// for and `n` names the question, so a tap that arrives late counts for nothing.
import type { Side } from './state';

export type ToHost = { t: 'vote'; at: number; n: number; side: Side };

const whole = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 1;

export function readToHost(raw: unknown): ToHost | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (m.t !== 'vote' || !whole(m.at) || !whole(m.n) || (m.side !== 0 && m.side !== 1)) return null;
  return { t: 'vote', at: m.at, n: m.n, side: m.side };
}
