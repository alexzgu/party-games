// Community packs this phone has or skips, and the list filtered by them.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isSkipped, localIdsOf, moveOwned, noteOwned, rereadMarks, setSkipped } from './communityMarks.svelte';
import { fits, hasMore, LAST_PAGE, loadPages } from './communityPages';
import { readFilters, viewUrl, withoutCommunity } from './communityView';
import type { Listing } from './communityCache';
import type { LibraryPack } from './library';
import { moveShared } from './shareLog.svelte';

let mem: Map<string, string>;
beforeEach(() => {
  mem = new Map();
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) });
  rereadMarks();
});
afterEach(() => vi.unstubAllGlobals());

describe('Community packs marked on this phone', () => {
  it('remembers which packs came from one, through a move to a new id, per game', () => {
    noteOwned('dial', 'AAA', ['trip', 'trip-x']);
    noteOwned('dial', 'AAA', ['trip', 'again']);
    noteOwned('quick', 'AAA', ['trip']);
    moveShared('dial', 'trip', 'my-trip'); // no share record needed
    rereadMarks();
    expect(localIdsOf('dial', 'AAA')).toEqual(['my-trip', 'trip-x', 'again']);
    expect(localIdsOf('quick', 'AAA')).toEqual(['trip']);
    moveOwned('quick', 'trip', 'q');
    expect(localIdsOf('quick', 'AAA')).toEqual(['q']);
    expect(localIdsOf('dial', 'BBB')).toEqual([]);
  });

  it('skips and unskips, apart from owning', () => {
    noteOwned('dial', 'AAA', ['trip']);
    setSkipped('dial', 'AAA', true);
    rereadMarks();
    expect([isSkipped('dial', 'AAA'), isSkipped('quick', 'AAA'), localIdsOf('dial', 'AAA')]).toEqual([true, false, ['trip']]);
    setSkipped('dial', 'AAA', false);
    expect([isSkipped('dial', 'AAA'), localIdsOf('dial', 'AAA')]).toEqual([false, ['trip']]);
  });

  it('reads a broken store as nothing marked', () => {
    mem.set('hr:community:marks', JSON.stringify({ owned: { 'dial:A': 'x', 'dial:B': ['ok', 7] }, skipped: [] }));
    rereadMarks();
    expect([localIdsOf('dial', 'A'), localIdsOf('dial', 'B'), isSkipped('dial', 'A')]).toEqual([[], ['ok'], false]);
  });
});

describe('the Community filters', () => {
  it('live in the address, with what is skipped hidden unless asked for', () => {
    const p = (s: string) => new URLSearchParams(s);
    expect(readFilters(p(''))).toEqual({ own: 'all', skip: 'unskipped' });
    expect(readFilters(p('cown=unowned&cskip=all'))).toEqual({ own: 'unowned', skip: 'all' });
    expect(readFilters(p('cown=x&cskip=y'))).toEqual({ own: 'all', skip: 'unskipped' });
    expect(viewUrl('/community/dial', p('cq=a'), { own: 'owned', skip: 'skipped' })).toBe('/community/dial?cq=a&cown=owned&cskip=skipped');
    expect(viewUrl('/community/dial', p('cown=owned&cskip=all'), { own: 'all', skip: 'unskipped', pack: 'p' })).toBe('/community/dial?cpack=p');
    expect(withoutCommunity('/dial', p('community=1&cown=owned&cskip=all'))).toBe('/dial');
  });

  it('choose each on its own', () => {
    const all = [[true, true], [true, false], [false, true], [false, false]].map(([owned, skipped]) => ({ owned, skipped }));
    const kept = (own: 'all' | 'owned' | 'unowned', skip: 'all' | 'skipped' | 'unskipped') => all.map((m) => fits({ own, skip }, m));
    expect(kept('all', 'all')).toEqual([true, true, true, true]);
    expect(kept('owned', 'unskipped')).toEqual([false, true, false, false]);
    expect(kept('unowned', 'skipped')).toEqual([false, false, true, false]);
  });
});

describe('loading pages for the filtered list', () => {
  const pack = (id: string): LibraryPack => ({ id, game: 'dial', name: id, blurb: '', count: 1, stars: 0, created: 0, updated: 0 });
  const server = (pages: number) => vi.fn(async (page: number) => ({ ok: true as const, packs: [pack(`p${page}`)], more: page < pages }));
  async function run(base: Listing | null, get: Parameters<typeof loadPages>[1], enough = (_: Listing) => false) {
    let last: Listing | null = base;
    const failure = await loadPages(base, get, enough, (l) => (last = l), () => false);
    return { failure, page: last?.page, more: last && hasMore(last) };
  }

  it('goes on while too few fit, at most 4 pages a press, and stops once enough do or no more come', async () => {
    expect(await run(null, server(50))).toEqual({ failure: null, page: 4, more: true });
    expect(await run({ packs: [pack('p1')], more: true, page: 1 }, server(50), (l) => l.packs.length >= 3)).toEqual({ failure: null, page: 3, more: true });
    expect(await run(null, server(2))).toEqual({ failure: null, page: 2, more: false });
  });

  it('never asks past page 100, and keeps the pages before a failure', async () => {
    const get = server(500);
    expect(await run({ packs: [], more: true, page: LAST_PAGE - 1 }, get)).toEqual({ failure: null, page: LAST_PAGE, more: false });
    expect(get.mock.calls).toEqual([[LAST_PAGE]]);
    const failing = async (page: number) => (page < 3 ? { ok: true as const, packs: [pack(`p${page}`)], more: true } : { ok: false as const, reason: 'offline' as const });
    expect(await run(null, failing)).toEqual({ failure: 'offline', page: 2, more: true });
  });
});
