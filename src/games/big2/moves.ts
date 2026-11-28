// Which plays a hand may make: against the play on the table (the same number of cards, beating
// it) or, leading, anything; the first play of a deal must hold the lowest card dealt.
import type { Card } from '../../lib/cards/deck';
import { beats, classify, type Combo } from './combos';
import { power, sortBig2 } from './order';

/** What a play must meet: the play to beat (null: a lead) and the card it must hold (null: none). */
export type Need = { table: Combo | null; first: Card | null };

/** Why a selection cannot be played, or null when it can. */
export type Fault = 'empty' | 'not a hand' | 'wrong size' | 'too low' | 'needs first';

export function fault(selection: readonly Card[], need: Need): Fault | null {
  if (!selection.length) return 'empty';
  const combo = classify(selection);
  if (!combo) return 'not a hand';
  if (need.first !== null && !selection.includes(need.first)) return 'needs first';
  if (!need.table) return null;
  if (combo.cards.length !== need.table.cards.length) return 'wrong size';
  return beats(combo, need.table) ? null : 'too low';
}

/** Every `k` cards of `cards`, in order. */
function choose(cards: readonly Card[], k: number, from = 0): Card[][] {
  if (k === 0) return [[]];
  const out: Card[][] = [];
  for (let i = from; i <= cards.length - k; i++) for (const rest of choose(cards, k - 1, i + 1)) out.push([cards[i], ...rest]);
  return out;
}

const SIZES = [1, 2, 3, 5];
const weakest = (a: Combo, b: Combo) => (beats(a, b) ? 1 : beats(b, a) ? -1 : power(a.cards.at(-1)!) - power(b.cards.at(-1)!));

/** Every play `hand` may make now, weakest first within each size, smaller sizes first. */
export function plays(hand: readonly Card[], need: Need): Combo[] {
  const cards = sortBig2(hand);
  const sizes = need.table ? [need.table.cards.length] : SIZES;
  return sizes.flatMap((k) => choose(cards, k)
    .filter((sel) => fault(sel, need) === null)
    .map((sel) => classify(sel)!)
    .sort(weakest));
}

/** The lowest single that may be played now (a lead, or one that beats a single), or null. */
export function lowestSingle(hand: readonly Card[], need: Need): Card | null {
  if (need.table && need.table.cards.length !== 1) return null;
  return sortBig2(hand).find((c) => fault([c], need) === null) ?? null;
}
