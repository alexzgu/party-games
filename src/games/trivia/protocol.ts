// The one message a phone sends the host: a tap on an answer. `at` ties it to the phase it was
// meant for and `n` names the question, so a tap that arrives late counts for nothing.
import type { Choice } from './state';

export type ToHost = { t: 'answer'; at: number; n: number; choice: Choice };

const whole = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 1;
const isChoice = (x: unknown): x is Choice => x === 0 || x === 1 || x === 2 || x === 3;

export function readToHost(raw: unknown): ToHost | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (m.t !== 'answer' || !whole(m.at) || !whole(m.n) || !isChoice(m.choice)) return null;
  return { t: 'answer', at: m.at, n: m.n, choice: m.choice };
}
