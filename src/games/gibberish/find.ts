// Search and sort for the pack list and a pack's cards.
import type { GibberishCard, GibberishPack } from '../../lib/content';
import { packAge } from '../../lib/content';
import { matches, sorted, type SortKey } from '../../lib/listing';

/** True when the query matches the card's phrase, answer or category. */
export const cardMatches = (c: GibberishCard, query: string) =>
  matches(c.answer, query) || matches(c.phrase, query) || matches(c.hint ?? '', query);

/**
 * Whether a pack matches, and, when only some of its cards do, a short line saying which
 * (`has “Ice Cream”`, `has “Ice Cream” and 2 more`). Empty `hit` when the name or blurb matches.
 */
export function packHit(p: GibberishPack, query: string): { match: boolean; hit: string } {
  if (matches(p.name, query) || matches(p.blurb, query)) return { match: true, hit: '' };
  const found = p.cards.filter((c) => cardMatches(c, query));
  if (!found.length) return { match: false, hit: '' };
  const first = found.find((c) => matches(c.answer, query)) ?? found[0];
  const more = found.length - 1;
  return { match: true, hit: `has “${first.answer}”${more ? ` and ${more} more` : ''}` };
}

/** The packs to show, in the chosen order, each with its hit line. */
export function findPacks(packs: GibberishPack[], query: string, sort: SortKey) {
  const found = packs.map((p) => ({ p, ...packHit(p, query) })).filter((x) => x.match);
  return sorted(found, sort, (x) => x.p.name, (x) => packAge(x.p));
}

/**
 * A pack's cards to show, each with its index in the pack, in the chosen order. The editor puts
 * new cards first, so a lower index is newer.
 */
export function findCards(cards: GibberishCard[], query: string, sort: SortKey) {
  const found = cards.map((c, i) => ({ c, i })).filter((x) => cardMatches(x.c, query));
  return sorted(found, sort, (x) => x.c.answer, (x) => -x.i);
}
