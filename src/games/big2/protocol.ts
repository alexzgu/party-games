// The messages a phone sends the host: a play (the cards it puts down) or a pass. `at` ties each
// to the turn it was meant for, so one that arrives late counts for nothing.
import { HAND_SIZE } from './state';
import { isCard, type Card } from '../../lib/cards/deck';

export type ToHost = { t: 'play'; at: number; cards: Card[] } | { t: 'pass'; at: number };

const whole = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 1;

export function readToHost(raw: unknown): ToHost | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (!whole(m.at)) return null;
  if (m.t === 'pass') return { t: 'pass', at: m.at };
  if (m.t !== 'play' || !Array.isArray(m.cards) || !m.cards.length || m.cards.length > HAND_SIZE || !m.cards.every(isCard)) return null;
  return { t: 'play', at: m.at, cards: [...m.cards] };
}
