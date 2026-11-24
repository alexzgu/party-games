// The one message a phone sends the host: an ask, a rank from another player. `at` ties it to the
// turn it was meant for, so an ask that arrives late counts for nothing.
import { isRank, type Rank } from '../../lib/cards/deck';

export type ToHost = { t: 'ask'; at: number; to: string; rank: Rank };

const whole = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 1;
const PID = /^[\w-]{1,64}$/;

export function readToHost(raw: unknown): ToHost | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (m.t !== 'ask' || !whole(m.at) || typeof m.to !== 'string' || !PID.test(m.to) || !isRank(m.rank)) return null;
  return { t: 'ask', at: m.at, to: m.to, rank: m.rank };
}
