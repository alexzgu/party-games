// The community library's rules as pure functions: what a published pack may hold, and what a
// list request asks for. The Durable Object in libraryObject.ts stores what passes them.
import { cleanExtra, cleanItems, itemCount, SHAPE } from '../../src/lib/libraryShape';
import type { Checked } from './validate';

/** Change these to loosen or tighten the library. */
export const LIBRARY = {
  /** Games whose packs the library takes (the app's pack games). */
  games: ['forehead', 'dial', 'gibberish', 'quick', 'quiz', 'taboo', 'snark'] as const,
  nameMax: 60,
  blurbMax: 140,
  /** The pack's items and extras as JSON, at most. */
  itemsBytes: 64 * 1024,
  /** Items in one pack, at most (Big Board: 8 categories of 10 clues; libraryShape.ts). */
  itemsMax: SHAPE.itemsMax,
  /** The phone's own id for the pack, at most. */
  localIdMax: 100,
  /** Publishes (new packs and updates) per pass per UTC day, and everyone together. */
  publishesPerSessionPerDay: 40,
  publishesPerDay: 600,
  pageSize: 30,
  queryMax: 100,
  /** Pages past this are not served (30 × 100 packs). */
  pageMax: 100,
  /** A search looks through this many packs of its order at most. */
  searchScan: 2000,
};

export type LibraryGame = (typeof LIBRARY.games)[number];
export const isLibraryGame = (g: unknown): g is LibraryGame => typeof g === 'string' && (LIBRARY.games as readonly string[]).includes(g);

/** A pack as checked for publishing. */
export interface PublishPack {
  game: LibraryGame;
  name: string;
  blurb: string;
  /** The phone's id for this pack: the same pass and id update one entry. */
  localId: string;
  items: unknown[];
  /** Fields beside the items: a Heads Down. pack's emoji, a Snark Tank pack's stock answers and finals. */
  extra: Record<string, unknown>;
  count: number;
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const str = (max: number) => (x: unknown): boolean => typeof x === 'string' && x.length <= max && x.trim().length > 0;

const bytes = (x: unknown) => new TextEncoder().encode(JSON.stringify(x)).length;

/** `{game, name, blurb, localId, items, extra?}` checked: the pack to store, or why not. */
export function checkPublish(raw: string): Checked<PublishPack> {
  let b: unknown;
  try {
    b = JSON.parse(raw);
  } catch {
    return { ok: false, message: 'Send the pack as JSON.' };
  }
  if (!isObj(b)) return { ok: false, message: 'Send the pack as JSON.' };
  if (!isLibraryGame(b.game)) return { ok: false, message: `game must be one of ${LIBRARY.games.join(', ')}.` };
  const game = b.game;
  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (!name || name.length > LIBRARY.nameMax) return { ok: false, message: `name must be 1 to ${LIBRARY.nameMax} characters.` };
  const blurb = b.blurb === undefined ? '' : typeof b.blurb === 'string' ? b.blurb.trim() : null;
  if (blurb === null || blurb.length > LIBRARY.blurbMax) return { ok: false, message: `blurb must be at most ${LIBRARY.blurbMax} characters.` };
  if (!str(LIBRARY.localIdMax)(b.localId)) return { ok: false, message: `localId must be 1 to ${LIBRARY.localIdMax} characters.` };
  // Rebuilt from each game's own fields only (libraryShape.ts): nothing else is stored.
  const cleaned = cleanItems(game, b.items);
  if ('problem' in cleaned) return { ok: false, message: cleaned.problem };
  const items = cleaned.items;
  const extra = cleanExtra(game, b.extra, items);
  if (bytes({ items, extra }) > LIBRARY.itemsBytes) return { ok: false, message: `A pack is limited to ${LIBRARY.itemsBytes / 1024} KB.` };
  const count = itemCount(game, items);
  return { ok: true, value: { game, name, blurb, localId: (b.localId as string).trim(), items, extra, count } };
}

export interface ListQuery {
  game: LibraryGame | null;
  /** Lowercased, spaces collapsed; '' lists everything. */
  q: string;
  sort: 'stars' | 'new';
  page: number;
}

/** The list request in `params`, or why it cannot be served. */
export function checkList(params: URLSearchParams): Checked<ListQuery> {
  const g = params.get('game') || null;
  if (g !== null && !isLibraryGame(g)) return { ok: false, message: `game must be one of ${LIBRARY.games.join(', ')}.` };
  const sort = params.get('sort') || 'stars';
  if (sort !== 'stars' && sort !== 'new') return { ok: false, message: 'sort must be stars or new.' };
  const pageText = params.get('page') || '1';
  const page = /^\d{1,5}$/.test(pageText) ? Number(pageText) : 0;
  if (page < 1 || page > LIBRARY.pageMax) return { ok: false, message: `page must be 1 to ${LIBRARY.pageMax}.` };
  return { ok: true, value: { game: g, q: searchText(params.get('q') ?? '').slice(0, LIBRARY.queryMax), sort, page } };
}

/** Text as searched: lowercase, every run of spaces one space, so a match never spans name and blurb. */
export const searchText = (t: string): string => t.toLowerCase().replace(/\s+/g, ' ').trim();

/** A pack's id in the library: 12 URL-safe characters. */
export const PACK_ID = /^[A-Za-z0-9_-]{12}$/;
