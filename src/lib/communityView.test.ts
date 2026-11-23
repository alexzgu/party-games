import { describe, expect, it } from 'vitest';
import { addedNote, readView, tabOf, viewUrl, withoutCommunity } from './communityView';
import { forgetListings, keepListing, keptShape, cachedListing, listingKey, MAX_KEPT_PACKS, starInListings, withPage } from './communityCache';
import type { LibraryPack } from './library';
import type { AnyPack } from './packfile';

const params = (s: string) => new URLSearchParams(s);
const pack = (id: string, stars = 0): LibraryPack => ({ id, game: 'dial', name: id, blurb: '', count: 3, stars, created: 0, updated: 0 });

describe('the Community view in the address', () => {
  it('reads the search, order and open pack, with safe defaults', () => {
    expect(readView(params(''))).toEqual({ q: '', sort: 'stars', pack: null });
    expect(readView(params('cq=%20cats%20&csort=new&cpack=AbC-12_x'))).toEqual({ q: 'cats', sort: 'new', pack: 'AbC-12_x' });
    expect(readView(params('csort=weird&cpack=../x'))).toEqual({ q: '', sort: 'stars', pack: null });
  });
  it('changes only its own parts and keeps the page’s', () => {
    expect(viewUrl('/dial', params('community=1&id=7'), { q: 'fun', sort: 'new' })).toBe('/dial?community=1&id=7&cq=fun&csort=new');
    expect(viewUrl('/community/dial', params('cq=fun&csort=new'), { pack: 'p1' })).toBe('/community/dial?cq=fun&csort=new&cpack=p1');
    expect(viewUrl('/community/dial', params('cq=fun&cpack=p1'), { pack: null, sort: 'stars' })).toBe('/community/dial?cq=fun');
    expect(viewUrl('/community', params('cq=x'), { q: '  ' })).toBe('/community');
  });
  it('closes the overlay back to the page under it', () => {
    expect(withoutCommunity('/dial', params('id=7&community=1&cq=a&csort=new&cpack=p'))).toBe('/dial?id=7');
    expect(withoutCommunity('/quiz', params('community=1'))).toBe('/quiz');
  });
  it('picks the tab from the path, else the first game', () => {
    expect(tabOf('/community/quiz', ['dial', 'quiz'])).toBe('quiz');
    expect(tabOf('/community', ['dial', 'quiz'])).toBe('dial');
    expect(tabOf('/community/salad', ['dial', 'quiz'])).toBe('dial');
    expect(tabOf('/community', [])).toBeNull();
  });
  it('says where an imported pack went', () => {
    const saved = [{ id: 'x', name: 'Road Trip' } as AnyPack];
    expect(addedNote('dial', { saved, skipped: 0, problems: [] })).toBe('“Road Trip” added to your packs in Spectrum.');
    expect(addedNote('forehead', { saved, skipped: 1, problems: ['2 already in the built-in packs left out.'] }))
      .toBe('“Road Trip” added to your packs in Heads Down. 1 word skipped. 2 already in the built-in packs left out.');
  });
});

describe('the Community lists kept while browsing', () => {
  it('adds pages without repeating a pack', () => {
    const first = withPage(null, { packs: [pack('a'), pack('b')], more: true });
    expect(first).toEqual({ packs: [pack('a'), pack('b')], more: true, page: 1 });
    const second = withPage(first, { packs: [pack('b'), pack('c')], more: false });
    expect(second.packs.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(second).toMatchObject({ more: false, page: 2 });
  });
  it('keeps lists by game, search and order until Community opens anew', () => {
    forgetListings();
    const key = listingKey('dial', ' cats ', 'new');
    expect(key).toBe(listingKey('dial', 'cats', 'new'));
    expect(key).not.toBe(listingKey('quiz', 'cats', 'new'));
    keepListing(key, withPage(null, { packs: [pack('a', 2)], more: false }));
    starInListings('a', 3, true);
    expect(cachedListing(key)?.packs[0]).toMatchObject({ stars: 3, starred: true });
    forgetListings();
    expect(cachedListing(key)).toBeUndefined();
  });
  it('keeps at most 24 lists, dropping the oldest', () => {
    forgetListings();
    for (let i = 0; i < 30; i++) keepListing(listingKey('dial', `q${i}`, 'stars'), withPage(null, { packs: [], more: false }));
    expect(cachedListing(listingKey('dial', 'q0', 'stars'))).toBeUndefined();
    expect(cachedListing(listingKey('dial', 'q29', 'stars'))).toBeDefined();
    expect(cachedListing(listingKey('dial', 'q6', 'stars'))).toBeDefined();
    forgetListings();
  });
  it("keeps each list's first 300 packs in the tab's storage, so Show more carries on after a reload", () => {
    const big = { packs: Array.from({ length: 330 }, (_, i) => pack(`p${i}`)), more: false, page: 11 };
    expect(keptShape(big)).toEqual({ packs: big.packs.slice(0, MAX_KEPT_PACKS), more: true, page: 10 });
    const small = { packs: [pack('a')], more: false, page: 1 };
    expect(keptShape(small)).toBe(small);
  });
});
