// Deals spectrum cards from the chosen packs without repeats across games: each pack keeps
// its own "seen" list, so changing the pack selection never wipes another pack's history.
import { makeBag } from '../../lib/bag';
import { spectrumPacks, type Spectrum } from '../../lib/content';
import { cardId } from './state';

/** Index chosen with probability proportional to its weight; `r` in [0, 1). */
export function pickWeighted(weights: number[], r: number): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = r * total;
  for (let i = 0; i < weights.length; i++) if ((roll -= weights[i]) < 0) return i;
  return weights.length - 1;
}

/**
 * Next card for this game. Packs are weighted by how many unseen cards they have left, so a
 * small pack is not used up while big ones are still fresh, and a card already played this
 * game is never dealt again (unless every chosen card has been played).
 */
export function drawCard(packIds: string[], played: readonly string[] = []): Spectrum | undefined {
  const all = spectrumPacks().filter((p) => p.cards.length > 0);
  let packs = all.filter((p) => packIds.includes(p.id));
  if (packs.length === 0) packs = all.filter((p) => !p.custom);
  if (packs.length === 0) return undefined;
  const bags = packs.map((p) => ({ size: p.cards.length, bag: makeBag('dial:' + p.id, p.cards, cardId) }));
  const used = new Set(played);
  const total = bags.reduce((n, b) => n + b.size, 0);
  let last: Spectrum | undefined;
  // Each bag deals every card once before refilling, so `total` tries reach any unplayed card.
  for (let attempt = 0; attempt <= total; attempt++) {
    const left = bags.map((b) => b.bag.remaining);
    const weights = left.some((n) => n > 0) ? left : bags.map((b) => b.size);
    const card = bags[pickWeighted(weights, Math.random())].bag.next();
    if (!card) continue;
    last = card;
    if (!used.has(cardId(card))) return card;
  }
  return last;
}
