// Deals cards from the chosen packs without repeats across games: each pack keeps its own
// "seen" list (lib/bag), so changing the selection never wipes another pack's history.
import { makeBag } from '../../lib/bag';
import { tabooPacks, type TabooCard } from '../../lib/content';
import { cardId } from './cards';

/** Index chosen with probability proportional to its weight; `r` in [0, 1). */
function pickWeighted(weights: number[], r: number): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = r * total;
  for (let i = 0; i < weights.length; i++) if ((roll -= weights[i]) < 0) return i;
  return weights.length - 1;
}

/**
 * Next card for this game, never one already dealt this game; undefined when the chosen
 * packs have none left. Packs are weighted by unseen cards left, so a small pack is not
 * used up while big ones are still fresh.
 */
export function drawCard(packIds: string[], played: readonly string[] = []): TabooCard | undefined {
  const packs = tabooPacks().filter((p) => p.cards.length > 0 && packIds.includes(p.id));
  if (packs.length === 0) return undefined;
  const used = new Set(played);
  const bags = packs.map((p) => ({ size: p.cards.length, fresh: p.cards.some((c) => !used.has(cardId(c))), bag: makeBag('taboo:' + p.id, p.cards, cardId) }));
  const live = bags.filter((b) => b.fresh);
  if (live.length === 0) return undefined;
  const total = live.reduce((n, b) => n + b.size, 0);
  // Each bag deals every card once before refilling, so `total` tries reach any unplayed card.
  for (let attempt = 0; attempt <= total * 2; attempt++) {
    const left = live.map((b) => b.bag.remaining);
    const weights = left.some((n) => n > 0) ? left : live.map((b) => b.size);
    const card = live[pickWeighted(weights, Math.random())].bag.next();
    if (card && !used.has(cardId(card))) return card;
  }
  return undefined;
}
