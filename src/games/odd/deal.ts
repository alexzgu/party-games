// Deals a round's word from Heads Down.'s packs. Each pack keeps its own "already seen" bag on
// this phone, under this game's own keys, so Heads Down.'s own rotation is never touched.
import { makeBag } from '../../lib/bag';
import { wordDecks, type WordDeck } from '../../lib/content';
import { wordKey, type Secret } from './logic';

/** How many draws to spend looking for a word not yet dealt this game before giving up. */
const MAX_TRIES = 50;

export function makeDealer(decks: readonly WordDeck[], rand: () => number = Math.random) {
  const bags = decks.filter((d) => d.words.length > 0).map((d) => ({ d, bag: makeBag('odd:' + d.id, d.words, wordKey, rand) }));

  /** A pack chosen in proportion to its unseen words (its size once all are seen), then its next word. */
  function draw(): Secret | undefined {
    const fresh = bags.filter((b) => b.bag.remaining > 0);
    const pool = fresh.length ? fresh.map((b) => ({ b, w: b.bag.remaining })) : bags.map((b) => ({ b, w: b.d.words.length }));
    let r = rand() * pool.reduce((n, p) => n + p.w, 0);
    const hit = pool.find((p) => (r -= p.w) < 0) ?? pool.at(-1);
    const word = hit?.b.bag.next();
    return hit && word ? { word, pack: hit.b.d.name } : undefined;
  }

  /** A word not in `used` (words dealt this game, folded) while one is left; any word after that. */
  return function next(used: readonly string[] = []): Secret | undefined {
    const seen = new Set(used);
    let s: Secret | undefined;
    for (let i = 0; i < MAX_TRIES; i++) {
      s = draw();
      if (!s || !seen.has(wordKey(s.word))) return s;
    }
    return s;
  };
}

/** The picked packs as they are now (own packs change), keeping only ids that still exist. */
export const pickedDecks = (ids: readonly string[]): WordDeck[] => wordDecks().filter((d) => ids.includes(d.id));

/** Names of the picked packs, in pack order, for a History entry. */
export const packNames = (ids: readonly string[]): string[] => pickedDecks(ids).map((d) => d.name);
