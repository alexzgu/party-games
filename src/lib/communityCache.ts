// The Community lists already loaded, by game, search and order, "Show more" pages included. They
// are kept from opening Community until it is opened anew (from the main menu or Add pack), in
// memory and in the tab's session storage, so Back from a preview or an import, a tab switch or a
// reload shows the same list at once, tall enough for its scroll to come back.
import type { LibraryPack, Sort } from './library';

export type Listing = { packs: LibraryPack[]; more: boolean; page: number };

const STORE = 'hr:community-lists';
/** Lists kept at most; the oldest go first. */
const MAX_LISTS = 24;
/** Packs of one list kept in session storage, at most: whole pages of the server's 30 (worker LIBRARY.pageSize). */
const PAGE = 30;
export const MAX_KEPT_PACKS = 10 * PAGE;

/** A list as session storage keeps it: its first pages up to MAX_KEPT_PACKS, so "Show more" carries on from there after a reload. */
export function keptShape(l: Listing): Listing {
  if (l.packs.length <= MAX_KEPT_PACKS) return l;
  return { packs: l.packs.slice(0, MAX_KEPT_PACKS), more: true, page: MAX_KEPT_PACKS / PAGE };
}

export const listingKey = (game: string, q: string, sort: Sort): string => JSON.stringify([game, q.trim(), sort]);

const isListing = (x: unknown): x is Listing => {
  const l = x as Listing;
  return !!l && typeof l === 'object' && Array.isArray(l.packs) && typeof l.more === 'boolean' && Number.isInteger(l.page) && l.page >= 1
    && l.packs.every((p) => !!p && typeof p === 'object' && typeof p.id === 'string' && typeof p.name === 'string');
};

function fromSession(): Map<string, Listing> {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(STORE) ?? '[]');
    if (!Array.isArray(raw)) return new Map();
    return new Map(raw.filter((e): e is [string, Listing] => Array.isArray(e) && typeof e[0] === 'string' && isListing(e[1])));
  } catch {
    return new Map(); // no session storage (tests, blocked) or a broken entry: start empty
  }
}

let lists: Map<string, Listing> | null = null;
const all = (): Map<string, Listing> => (lists ??= fromSession());

function persist(): void {
  try {
    // Memory keeps every page shown this time; the tab's storage only the first ones of each list.
    sessionStorage.setItem(STORE, JSON.stringify([...all()].map(([k, l]) => [k, keptShape(l)])));
  } catch {
    /* full or blocked: memory still has them */
  }
}

export const cachedListing = (key: string): Listing | undefined => all().get(key);

export function keepListing(key: string, listing: Listing): void {
  const m = all();
  m.delete(key); // newest last
  m.set(key, listing);
  while (m.size > MAX_LISTS) m.delete(m.keys().next().value as string);
  persist();
}

/** Community opened anew: every list is loaded fresh. */
export function forgetListings(): void {
  all().clear();
  persist();
}

/** `before` with one more page from the server, packs already shown left out; no `before`: the first page. */
export function withPage(before: Listing | null | undefined, got: { packs: LibraryPack[]; more: boolean }): Listing {
  if (!before) return { packs: got.packs, more: got.more, page: 1 };
  const seen = new Set(before.packs.map((p) => p.id));
  return { packs: [...before.packs, ...got.packs.filter((p) => !seen.has(p.id))], more: got.more, page: before.page + 1 };
}

/** A pack's new stars in every kept list that shows it. */
export function starInListings(id: string, stars: number, starred: boolean): void {
  let changed = false;
  for (const [key, l] of all()) {
    if (!l.packs.some((p) => p.id === id)) continue;
    all().set(key, { ...l, packs: l.packs.map((p) => (p.id === id ? { ...p, stars, starred } : p)) });
    changed = true;
  }
  if (changed) persist();
}
