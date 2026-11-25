// Deals spectrum cards from the chosen packs without repeats across games: each pack keeps
// its own "seen" list, so changing the pack selection never wipes another pack's history.
import { makeBag } from '../../lib/bag';
import { spectrumPacks, type Spectrum, type SpectrumPack } from '../../lib/content';
import { ask, lenders, pickedOr, type Ask } from '../../lib/lend';
import { cardId } from './state';

/** What a game picks when none of its picks exists. */
export const DEFAULT_PACKS = ['classic'];

export interface RoomDeck {
  /** The packs picked (Classic when none of the picks exists). */
  packs: SpectrumPack[];
  /** The packs that would lend, in pack order; none when the picks have cards. */
  lent: SpectrumPack[];
  /** The question before the lenders' cards join, or null when nothing would be added. */
  ask: Ask | null;
  /** Why no game can start even with the lenders, or ''. */
  problem: string;
}

const cards = (ps: readonly SpectrumPack[]) => ps.reduce((n, p) => n + p.cards.length, 0);

/**
 * The cards a game deals from, worked out once for the setup screen, its note, the question
 * before Start and Start itself: the picked packs' (Classic's when none of the picks exists).
 * A game runs until a team reaches the goal, so it needs only a card; when the picks have none,
 * the first pack with cards would lend (src/lib/lend.ts), but only once the player says yes.
 */
export function roomDeck(all: readonly SpectrumPack[], ids: readonly string[]): RoomDeck {
  const packs = pickedOr(all, ids, DEFAULT_PACKS);
  const lent = lenders(all.filter((p) => !packs.includes(p)), (l) => !cards([...packs, ...l]), (p) => p.cards.length > 0);
  return { packs, lent, problem: cards([...packs, ...lent]) ? '' : 'No pack has cards', ask: ask(packs, lent, 'Your packs have no cards.', 'cards') };
}

/** The packs a game deals from: its picks (Classic when none exists) and the packs lent to it. */
export function gamePacks(all: readonly SpectrumPack[], ids: readonly string[], lent: readonly string[] = []): SpectrumPack[] {
  const packs = pickedOr(all, ids, DEFAULT_PACKS);
  return [...packs, ...all.filter((p) => lent.includes(p.id) && !packs.includes(p))];
}

/** Index chosen with probability proportional to its weight; `r` in [0, 1). */
export function pickWeighted(weights: number[], r: number): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = r * total;
  for (let i = 0; i < weights.length; i++) if ((roll -= weights[i]) < 0) return i;
  return weights.length - 1;
}

/**
 * Next card for this game, from its packs (`gamePacks`) and nothing else. Packs are weighted by how many unseen cards they have left, so a
 * small pack is not used up while big ones are still fresh, and a card already played this
 * game is never dealt again (unless every chosen card has been played).
 */
export function drawCard(packIds: string[], played: readonly string[] = [], lent: readonly string[] = []): Spectrum | undefined {
  const packs = gamePacks(spectrumPacks(), packIds, lent).filter((p) => p.cards.length > 0);
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
