import { describe, expect, it } from 'vitest';
import { batches, fresh, makeLimiter, remember, type Clock } from './limit';

/** Fake time: sleep() moves the clock forward instead of waiting. */
function fakeClock(): Clock & { t: number } {
  const c = { t: 0, now: () => c.t, sleep: async (ms: number) => { c.t += ms; } };
  return c;
}

describe('Apple rate limit', () => {
  it('lets the first calls through at once, then spaces the rest to the window', async () => {
    const clock = fakeClock();
    const limiter = makeLimiter(3, 60_000, clock);
    const started: number[] = [];
    const calls = Array.from({ length: 7 }, (_, i) => limiter.run(async () => { started.push(clock.now()); return i; }));
    expect(await Promise.all(calls)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(started).toEqual([0, 0, 0, 60_000, 60_000, 60_000, 120_000]);
    // Never more than 3 in any minute.
    for (const t of started) expect(started.filter((s) => s > t - 60_000 && s <= t).length).toBeLessThanOrEqual(3);
  });

  it('keeps going after a failed call, and estimates the wait', async () => {
    const clock = fakeClock();
    const limiter = makeLimiter(2, 1000, clock);
    const bad = limiter.run(async () => { throw new Error('offline'); });
    await expect(bad).rejects.toThrow('offline');
    expect(await limiter.run(async () => 'ok')).toBe('ok');
    expect(limiter.etaSeconds(0)).toBe(0);
    expect(limiter.etaSeconds(4)).toBe(2);
    expect(limiter.delay()).toBe(1000);
  });

  it('batches lookups', () => {
    expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(batches([], 50)).toEqual([]);
  });

  it('remembers answers with a timestamp, forgets stale ones, and keeps the newest', () => {
    let cache = remember<string>({}, [['1', 'a']], 1000, 10);
    cache = remember(cache, [['2', null]], 1500, 10);
    expect(fresh(cache, '1', 2000, 5000)).toBe('a');
    expect(fresh(cache, '2', 2000, 5000)).toBeNull();
    expect(fresh(cache, '1', 7000, 5000)).toBeUndefined();
    expect(fresh(cache, '3', 2000, 5000)).toBeUndefined();
    cache = remember(cache, [['3', 'c']], 3000, 2);
    expect(Object.keys(cache).sort()).toEqual(['2', '3']);
  });
});
