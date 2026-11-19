// Keeping under Apple's limit (about 20 calls a minute per address): a queue that spaces calls
// out, lookups batched many ids per call, and answers remembered with a timestamp. Pure apart
// from the clock it is given, so the tests run it on fake time.

export interface Clock { now(): number; sleep(ms: number): Promise<void> }
export const realClock: Clock = { now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };

/** At most `max` calls in any `windowMs`, run one after another in the order asked. */
export function makeLimiter(max: number, windowMs: number, clock: Clock = realClock) {
  const stamps: number[] = [];
  let chain: Promise<unknown> = Promise.resolve();
  let waiting = 0;

  /** How long a call asked for now would wait, in ms (0 when it can go at once). */
  function delay(): number {
    const now = clock.now();
    while (stamps.length && stamps[0] <= now - windowMs) stamps.shift();
    return stamps.length < max ? 0 : stamps[0] + windowMs - now;
  }

  async function slot() {
    for (let d = delay(); d > 0; d = delay()) await clock.sleep(d);
    stamps.push(clock.now());
  }

  return {
    /** Runs `fn` when a slot is free. */
    run<T>(fn: () => Promise<T>): Promise<T> {
      waiting++;
      const p = chain.then(slot).then(() => { waiting--; return fn(); }, (e) => { waiting--; throw e; });
      chain = p.catch(() => undefined);
      return p;
    },
    /** Calls queued and not yet started. */
    get waiting() { return waiting; },
    /** Seconds until `n` more calls would all have run, for "about a minute left". */
    etaSeconds(n: number): number {
      const free = Math.max(0, max - stamps.length);
      if (n <= free) return 0;
      return Math.ceil(((n - free) / max) * (windowMs / 1000));
    },
    delay,
  };
}

export type Limiter = ReturnType<typeof makeLimiter>;

/** Splits ids into lookup calls of at most `size`. */
export function batches<T>(ids: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/** A remembered answer and when it was fetched. `value` null means "Apple had nothing". */
export interface Cached<T> { at: number; value: T | null }

/** The cached answer for a key while it is fresh, else undefined. */
export function fresh<T>(cache: Record<string, Cached<T>>, key: string, now: number, maxAgeMs: number): T | null | undefined {
  const hit = cache[key];
  if (!hit || now - hit.at > maxAgeMs || now < hit.at) return undefined;
  return hit.value;
}

/** The cache with new answers in, trimmed to the newest `keep` entries. */
export function remember<T>(cache: Record<string, Cached<T>>, entries: [string, T | null][], now: number, keep: number): Record<string, Cached<T>> {
  const next = { ...cache };
  for (const [k, value] of entries) next[k] = { at: now, value };
  const keys = Object.keys(next);
  if (keys.length <= keep) return next;
  keys.sort((a, b) => next[b].at - next[a].at);
  return Object.fromEntries(keys.slice(0, keep).map((k) => [k, next[k]]));
}
