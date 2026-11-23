// Messages a phone sends the host. `at` ties each to the phase it was meant for; a trade carries
// the player's trade count instead, so a re-sent one is done once.
import { BLANK_MAX } from './cards';

export type ToHost =
  | { t: 'play'; at: number; cards: number[]; texts: string[] }
  /** The judge shows one answer large on the host. */
  | { t: 'spot'; at: number; i: number }
  | { t: 'pick'; at: number; i: number }
  | { t: 'vote'; at: number; i: number }
  | { t: 'trade'; n: number; cards: number[] };

const whole = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
const ids = (x: unknown, max: number): x is number[] => Array.isArray(x) && x.length >= 1 && x.length <= max && x.every(whole);

export function readToHost(raw: unknown): ToHost | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (m.t === 'trade') return whole(m.n) && ids(m.cards, 10) ? { t: m.t, n: m.n, cards: m.cards } : null;
  if (!whole(m.at) || m.at < 1) return null;
  const at = m.at;
  if ((m.t === 'spot' || m.t === 'pick' || m.t === 'vote') && whole(m.i)) return { t: m.t, at, i: m.i };
  if (m.t !== 'play' || !ids(m.cards, 2) || !Array.isArray(m.texts) || m.texts.length !== m.cards.length) return null;
  if (!m.texts.every((s) => typeof s === 'string' && s.length <= BLANK_MAX)) return null;
  return { t: m.t, at, cards: m.cards, texts: m.texts as string[] };
}
