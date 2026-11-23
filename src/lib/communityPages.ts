// The Community list as filtered on the phone: the server sends whole pages of 30, the filters
// (communityView.ts) choose among them, and a page that leaves too few loads the next ones.
import type { Filters } from './communityView';
import { withPage, type Listing } from './communityCache';
import type { Failure, Got, LibraryPack } from './library';

/** A press (opening, Show more, a filter) stops loading once it shows this many packs that fit. */
export const ENOUGH = 10;
/** Pages one press loads at most. */
export const PAGES_PER_PRESS = 4;
/** The server serves no page past this (worker LIBRARY.pageMax). */
export const LAST_PAGE = 100;

/** True when a pack with these marks fits the filters. */
export function fits(f: Filters, mark: { owned: boolean; skipped: boolean }): boolean {
  const own = f.own === 'all' || (f.own === 'owned') === mark.owned;
  const skip = f.skip === 'all' || (f.skip === 'skipped') === mark.skipped;
  return own && skip;
}

export const hasMore = (l: Listing): boolean => l.more && l.page < LAST_PAGE;

type Page = Got<{ packs: LibraryPack[]; more: boolean }>;

/**
 * Loads pages after `base` (none: from the first) until `enough` says so, the server has no more,
 * one fails or the press's share is used up. `onpage` gets the list after each page; false from it
 * stops (the list is no longer wanted). Returns the failure, or null.
 */
export async function loadPages(base: Listing | null, get: (page: number) => Promise<Page>, enough: (l: Listing) => boolean, onpage: (l: Listing) => void, stopped: () => boolean): Promise<Failure | null> {
  let l = base;
  for (let n = 0; n < PAGES_PER_PRESS; n++) {
    const r = await get(l ? l.page + 1 : 1);
    if (stopped()) return null;
    if (!r.ok) return r.reason;
    l = withPage(l, r);
    onpage(l);
    if (!hasMore(l) || enough(l)) return null;
  }
  return null;
}
