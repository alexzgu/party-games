// Heads Down.'s decks in the shared pack list, and search and order for a deck's word list.
import { customDecks, type WordDeck } from '../../lib/content';
import { matches, sorted, type SortKey } from '../../lib/listing';
import { counted, packTag, type PackEntry } from '../../lib/packList';

/** A deck as the setup's pack list shows it. */
export const deckEntry = (d: WordDeck): PackEntry => ({
  id: d.id, name: d.name, blurb: d.blurb, added: d.added, icon: d.emoji || '🃏',
  size: d.words.length, sizeLabel: counted(d.words.length, 'words'), tag: packTag(d.custom, customDecks.isEdited(d.id)),
  items: d.words.map((label) => ({ label })),
});

/** A deck's words in the chosen order. New words go on top, so a lower index is newer. */
export function findWords(words: readonly string[], query: string, sort: SortKey): string[] {
  return sorted(words, sort, (w) => w, (_, i) => -i).filter((w) => matches(w, query));
}
