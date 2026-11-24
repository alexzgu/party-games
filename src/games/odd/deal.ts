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

const hasWords = (decks: readonly WordDeck[]) => decks.some((d) => d.words.length > 0);

/** The picks on a first visit: every built-in pack but the adults-only one. */
export const defaultPicks = (decks: readonly WordDeck[]): string[] => decks.filter((d) => !d.custom && d.id !== 'after-dark').map((d) => d.id);

/**
 * The next round's word for a game in progress, with the packs it now plays: the game's own
 * while they have words, else `fallback` (the setup's current picks, so a game whose packs were
 * deleted carries on by itself). Null when neither has a word.
 */
export function nextWord(game: { packIds: readonly string[]; used: readonly string[] }, fallback: readonly string[], all: readonly WordDeck[] = wordDecks(), rand: () => number = Math.random): { secret: Secret; packIds: string[] } | null {
  const own = all.filter((d) => game.packIds.includes(d.id));
  const ids = hasWords(own) ? game.packIds : fallback;
  const decks = all.filter((d) => ids.includes(d.id));
  const secret = hasWords(decks) ? makeDealer(decks, rand)(game.used) : undefined;
  return secret ? { secret, packIds: [...ids] } : null;
}
