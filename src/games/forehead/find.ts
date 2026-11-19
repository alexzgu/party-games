// Search and order for Heads Down.'s deck lists and a deck's word list.
import { packAge, type WordDeck } from '../../lib/content';
import { matches, sorted, type SortKey } from '../../lib/listing';

/** A deck in a searched list; `via` is the first word that matched when the name and blurb did not. */
export interface DeckHit { deck: WordDeck; via?: string }

function hit(deck: WordDeck, query: string): DeckHit | null {
  if (matches(`${deck.name} ${deck.blurb}`, query)) return { deck };
  const via = deck.words.find((w) => matches(w, query));
  return via ? { deck, via } : null;
}

/** Decks in the chosen order that match the query by name, blurb or any word. */
export function findDecks(decks: readonly WordDeck[], query: string, sort: SortKey): DeckHit[] {
  return sorted(decks, sort, (d) => d.name, packAge).flatMap((d) => hit(d, query) ?? []);
}

/** A deck's words in the chosen order. New words go on top, so a lower index is newer. */
export function findWords(words: readonly string[], query: string, sort: SortKey): string[] {
  return sorted(words, sort, (w) => w, (_, i) => -i).filter((w) => matches(w, query));
}
