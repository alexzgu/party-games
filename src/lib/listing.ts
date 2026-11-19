// Search and sort for pack lists and pack contents. Each list remembers, per phone, whether its
// search bar and sort row are shown and which order it uses.
import { load, save } from './storage';

export type SortKey = 'suggested' | 'newest' | 'oldest' | 'az';

export const SORTS: { value: SortKey; label: string }[] = [
  { value: 'suggested', label: 'Suggested' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'az', label: 'A–Z' },
];

export interface ListPrefs { search: boolean; sorting: boolean; sort: SortKey }
const DEFAULT_PREFS: ListPrefs = { search: false, sorting: false, sort: 'suggested' };

export const loadPrefs = (key: string): ListPrefs => load(`list:${key}`, DEFAULT_PREFS);
export const savePrefs = (key: string, prefs: ListPrefs): void => save(`list:${key}`, prefs);

/** Lower case, accents and punctuation dropped, spaces collapsed: "Pokémon!" → "pokemon". */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/** True when every word of the query starts a word in the text ("lio ki" matches "The Lion King"). */
export function matches(text: string, query: string): boolean {
  const q = fold(query);
  if (!q) return true;
  const words = fold(text).split(' ');
  return q.split(' ').every((t) => words.some((w) => w.startsWith(t)));
}

/**
 * Sorts a list that is already in its suggested order. `age` is anything that grows with time
 * (a timestamp, or the position an item was added at); ties keep the suggested order.
 */
export function sorted<T>(items: readonly T[], sort: SortKey, name: (x: T) => string, age: (x: T, i: number) => number): T[] {
  const indexed = items.map((x, i) => ({ x, i, a: age(x, i) }));
  const by: Record<SortKey, (p: (typeof indexed)[0], q: (typeof indexed)[0]) => number> = {
    suggested: (p, q) => p.i - q.i,
    newest: (p, q) => q.a - p.a || p.i - q.i,
    oldest: (p, q) => p.a - q.a || p.i - q.i,
    az: (p, q) => name(p.x).localeCompare(name(q.x), undefined, { sensitivity: 'base', numeric: true }) || p.i - q.i,
  };
  return indexed.sort(by[sort]).map((p) => p.x);
}
