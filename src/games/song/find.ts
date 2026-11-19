// Search and sort for the pack list and a pack's songs.
import type { Song, SongPack } from '../../lib/content';
import { packAge } from '../../lib/content';
import { matches, sorted, type SortKey } from '../../lib/listing';

/** True when the query matches the song's title or artist. */
export const songMatches = (s: Song, query: string) => matches(s.title, query) || matches(s.artist, query);

/** Whether a pack matches, and, when only some songs do, a short line saying which. */
export function packHit(p: SongPack, query: string): { match: boolean; hit: string } {
  if (matches(p.name, query) || matches(p.blurb, query)) return { match: true, hit: '' };
  const found = p.songs.filter((s) => songMatches(s, query));
  if (!found.length) return { match: false, hit: '' };
  const more = found.length - 1;
  return { match: true, hit: `has “${found[0].title}”${more ? ` and ${more} more` : ''}` };
}

/** The packs to show, in the chosen order, each with its hit line. */
export function findPacks(packs: SongPack[], query: string, sort: SortKey) {
  const found = packs.map((p) => ({ p, ...packHit(p, query) })).filter((x) => x.match);
  return sorted(found, sort, (x) => x.p.name, (x) => packAge(x.p));
}

/** A pack's songs to show, each with its index in the pack; new songs go first, so lower is newer. */
export function findSongs(songs: Song[], query: string, sort: SortKey) {
  const found = songs.map((s, i) => ({ s, i })).filter((x) => songMatches(x.s, query));
  return sorted(found, sort, (x) => x.s.title, (x) => -x.i);
}
