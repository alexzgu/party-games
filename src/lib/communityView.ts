// Where the Community packs stand, kept in the address so Back and a reload find them as they
// were left: the search (`cq`), the order (`csort`; none means most stars), the filters (`cown`,
// `cskip`; none means all, and not the skipped) and the pack open in the preview (`cpack`, its own
// history entry). The same names work on the Community page
// (`#/community/<game>`) and on the overlay over a game's pack list (`?community=1`).
import { gameName, type PackGameId } from '../app.config';
import { LIBRARY_GAMES, libraryOn, type Sort } from './library';
import { unitOf, type ImportResult } from './packfile';

export type CommunityView = { q: string; sort: Sort; pack: string | null };

/** Which packs the list shows, by what this phone has and skips (communityMarks.svelte.ts). */
export type Filters = { own: 'all' | 'owned' | 'unowned'; skip: 'all' | 'skipped' | 'unskipped' };

const PACK_ID = /^[\w-]{1,32}$/;

export function readView(params: URLSearchParams): CommunityView {
  const pack = params.get('cpack');
  return {
    q: (params.get('cq') ?? '').trim().slice(0, 100),
    sort: params.get('csort') === 'new' ? 'new' : 'stars',
    pack: pack && PACK_ID.test(pack) ? pack : null,
  };
}

export function readFilters(params: URLSearchParams): Filters {
  const own = params.get('cown'), skip = params.get('cskip');
  return {
    own: own === 'owned' || own === 'unowned' ? own : 'all',
    skip: skip === 'all' || skip === 'skipped' ? skip : 'unskipped',
  };
}

const withQuery = (path: string, params: URLSearchParams): string => {
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
};

/** `path` with the view's parts changed by `patch`; every other parameter kept. */
export function viewUrl(path: string, params: URLSearchParams, patch: Partial<CommunityView & Filters>): string {
  const v = { ...readView(params), ...readFilters(params), ...patch };
  const next = new URLSearchParams(params);
  const put = (name: string, value: string | null) => (value ? next.set(name, value) : next.delete(name));
  put('cq', v.q.trim());
  put('csort', v.sort === 'new' ? 'new' : null);
  put('cown', v.own === 'all' ? null : v.own);
  put('cskip', v.skip === 'unskipped' ? null : v.skip);
  put('cpack', v.pack);
  return withQuery(path, next);
}

/** The page under the Community overlay: its address without anything Community added. */
export function withoutCommunity(path: string, params: URLSearchParams): string {
  const next = new URLSearchParams(params);
  for (const name of ['community', 'cq', 'csort', 'cown', 'cskip', 'cpack']) next.delete(name);
  return withQuery(path, next);
}

/** The games on the Community page, in `LIBRARY_GAMES` order (none without a wizard server). */
export const communityGames = (): PackGameId[] => LIBRARY_GAMES.filter((g) => libraryOn(g));

/** The Community page's game: `#/community/<game>`, else the first game. */
export function tabOf(path: string, games: readonly PackGameId[]): PackGameId | null {
  const id = path.split('/').filter(Boolean)[1];
  return games.find((g) => g === id) ?? games[0] ?? null;
}

/** What the Community page says after an import: where the pack went, and anything left out. */
export function addedNote(game: PackGameId, r: Exclude<ImportResult, { error: string }>): string {
  const name = r.saved[0]?.name ?? 'The pack';
  const where = gameName(game);
  const parts = [`“${name}” added to your packs in ${where}${where.endsWith('.') ? '' : '.'}`];
  if (r.skipped) parts.push(`${r.skipped} ${unitOf(game, r.skipped)} skipped.`);
  return [...parts, ...r.problems].join(' ');
}
