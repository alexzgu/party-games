import { describe, expect, it, vi } from 'vitest';
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

  it('deals a one-item pool repeatedly and after reloading its saved history', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    try {
      const open = () => makeBag('single', [{ id: 'only' }], (item) => item.id);
      const bag = open();
      expect(bag.next()).toEqual({ id: 'only' });
      expect(bag.next()).toEqual({ id: 'only' });
      const reloaded = open();
      expect(reloaded.remaining).toBe(0);
      expect(reloaded.next()).toEqual({ id: 'only' });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('puts back an item dealt but never played: unseen again and dealt before any repeat', () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) });
    try {
      const items = ['a', 'b', 'c', 'd'];
      const bag = makeBag('back', items, (x) => x);
      const first = bag.next()!;
      bag.next();
      bag.putBack(first);
      expect(bag.remaining).toBe(3);
      expect(makeBag('back', items, (x) => x).remaining).toBe(3); // forgotten in storage too
      const rest = [bag.next(), bag.next(), bag.next()];
      expect(rest).toContain(first);
      expect(bag.remaining).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('returns undefined for an empty pool', () => {
    expect(makeBag('t2', [], (x: string) => x).next()).toBeUndefined();
  });
});
