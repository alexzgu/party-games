export const GUESS_MAX = 80;
export const NAME_MAX = 18;

export type Action =
  | { t: 'pick'; index: number; reshuffled: boolean }
  | { t: 'reshuffle' }
  | { t: 'skipFrame' | 'publish'; frame: number }
  | { t: 'more'; frame: number; slot: number }
  | { t: 'word'; frame: number; slot: number; value: string }
  | { t: 'guess'; id: string; text: string };

export type ToHost = Action & { serial: number };

const index = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const short = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max;

export function readToHost(raw: unknown): ToHost | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as Record<string, unknown>;
  if (!index(m.serial)) return null;
  const base = { serial: m.serial };
  switch (m.t) {
    case 'pick': return index(m.index) && typeof m.reshuffled === 'boolean'
      ? { ...base, t: m.t, index: m.index, reshuffled: m.reshuffled } : null;
    case 'reshuffle': return { ...base, t: m.t };
    case 'skipFrame':
    case 'publish': return index(m.frame) ? { ...base, t: m.t, frame: m.frame } : null;
    case 'more': return index(m.frame) && index(m.slot) ? { ...base, t: m.t, frame: m.frame, slot: m.slot } : null;
    case 'word': return index(m.frame) && index(m.slot) && short(m.value, GUESS_MAX)
      ? { ...base, t: m.t, frame: m.frame, slot: m.slot, value: m.value } : null;
    case 'guess': return short(m.id, 80) && short(m.text, GUESS_MAX)
      ? { ...base, t: m.t, id: m.id, text: m.text } : null;
    default: return null;
  }
}
