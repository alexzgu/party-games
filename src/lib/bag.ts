import { load, save } from './storage';
import { shuffle } from './random';

/**
 * Deals items without repeats across rounds and app restarts: what was dealt is remembered
 * per pool, and the pool only refills once every item has been seen. On a refill the most
 * recently dealt items stay held back, so tonight's cards never come straight back.
 */
export function makeBag<T>(poolKey: string, items: readonly T[], idOf: (t: T) => string) {
  const key = 'seen:' + poolKey;
  const valid = new Set(items.map(idOf));
  // Insertion-ordered, oldest first, so a refill can keep the newest.
  const seen = new Set<string>(load<string[]>(key, []).filter((id) => valid.has(id)));
  let queue: T[] = [];

  function refill() {
    let fresh = items.filter((t) => !seen.has(idOf(t)));
    if (fresh.length === 0) {
      const holdback = Math.min(Math.floor(items.length / 2), 60);
      const keep = holdback ? [...seen].slice(-holdback) : [];
      seen.clear();
      keep.forEach((id) => seen.add(id));
      fresh = items.filter((t) => !seen.has(idOf(t)));
    }
    queue = shuffle(fresh);
  }

  return {
    next(): T | undefined {
      if (items.length === 0) return undefined;
      if (queue.length === 0) refill();
      const item = queue.pop()!;
      seen.delete(idOf(item));
      seen.add(idOf(item));
      save(key, [...seen]);
      return item;
    },
    get remaining() {
      return items.filter((t) => !seen.has(idOf(t))).length;
    },
    reset() {
      seen.clear();
      queue = [];
      save(key, []);
    },
  };
}
