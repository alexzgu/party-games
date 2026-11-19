// Deals cards from the chosen packs. Each pack keeps its own "already seen" history, so
// switching pack combinations never resets what a group has already played.
import { makeBag } from '../../lib/bag';
import { gibberishPacks, type GibberishCard } from '../../lib/content';
import { answerKey } from './parse';

const cardId = (c: GibberishCard) => (c.phrase + '|' + c.answer).toLowerCase();

/** How many draws to spend looking for an answer not yet dealt this game before giving up. */
const MAX_TRIES = 25;

export function makeDealer(packIds: string[]) {
  const packs = gibberishPacks().filter((p) => packIds.includes(p.id) && p.cards.length > 0);
  const bags = packs.map((p) => ({ size: p.cards.length, bag: makeBag('gibberish:' + p.id, p.cards, cardId) }));

  /** One card, from a pack chosen in proportion to its unseen cards (its size once all are seen). */
  function draw(): GibberishCard | undefined {
    const fresh = bags.filter((b) => b.bag.remaining > 0);
    const pool = fresh.length ? fresh.map((b) => ({ b, w: b.bag.remaining })) : bags.map((b) => ({ b, w: b.size }));
    let r = Math.random() * pool.reduce((n, p) => n + p.w, 0);
    const pick = pool.find((p) => (r -= p.w) < 0) ?? pool[pool.length - 1];
    return pick?.b.bag.next();
  }

  return {
    total: bags.reduce((n, b) => n + b.size, 0),
    /** A card whose answer is not in `dealt` (answers already played this game), when one is left. */
    next(dealt: readonly string[] = []): GibberishCard | undefined {
      const used = new Set(dealt);
      let card: GibberishCard | undefined;
      for (let i = 0; i < MAX_TRIES; i++) {
        card = draw();
        if (!card || !used.has(answerKey(card))) return card;
      }
      return card;
    },
  };
}

/** Names of the chosen packs, in pack order, for a history entry. */
export function packNames(packIds: string[]): string[] {
  return gibberishPacks().filter((p) => packIds.includes(p.id)).map((p) => p.name);
}
