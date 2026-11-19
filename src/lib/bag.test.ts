import { describe, expect, it } from 'vitest';
import { makeBag } from './bag';

describe('makeBag', () => {
  it('deals every item once before any repeats', () => {
    const items = ['a', 'b', 'c', 'd'];
    const bag = makeBag('t1', items, (x) => x);
    const first = [bag.next(), bag.next(), bag.next(), bag.next()];
    expect(new Set(first)).toEqual(new Set(items));
    expect(items).toContain(bag.next());
  });

  it('holds back the most recent items when a pool refills', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'];
    const bag = makeBag('t3', items, (x) => x);
    const firstPass = items.map(() => bag.next()!);
    const lastThree = firstPass.slice(-3);
    const refill = [bag.next()!, bag.next()!, bag.next()!];
    expect(refill.some((x) => lastThree.includes(x))).toBe(false);
  });

  it('returns undefined for an empty pool', () => {
    expect(makeBag('t2', [], (x: string) => x).next()).toBeUndefined();
  });
});
