// Inn Co Hear Ant's packs in the shared pack list, and search and sort for a pack's cards.
import { customGibberish, type GibberishCard, type GibberishPack } from '../../lib/content';
import { matches, sorted, type SortKey } from '../../lib/listing';
import { counted, packTag, type PackEntry } from '../../lib/packList';

/** True when the query matches the card's phrase, answer or category. */
export const cardMatches = (c: GibberishCard, query: string) =>
  matches(c.answer, query) || matches(c.phrase, query) || matches(c.hint ?? '', query);

/** A pack as the setup's pack list shows it; a search hit names a card's answer. */
export const packEntry = (p: GibberishPack): PackEntry => ({
  id: p.id, name: p.name, blurb: p.blurb, added: p.added,
  size: p.cards.length, sizeLabel: counted(p.cards.length, 'cards'), tag: packTag(p.custom, customGibberish.isEdited(p.id)),
  items: p.cards.map((c) => ({ label: c.answer, text: `${c.answer} ${c.phrase} ${c.hint ?? ''}` })),
});

/**
 * A pack's cards to show, each with its index in the pack, in the chosen order. The editor puts
 * new cards first, so a lower index is newer.
 */
export function findCards(cards: GibberishCard[], query: string, sort: SortKey) {
  const found = cards.map((c, i) => ({ c, i })).filter((x) => cardMatches(x.c, query));
  return sorted(found, sort, (x) => x.c.answer, (x) => -x.i);
}
