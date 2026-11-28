// Big 2's card order: rank 3 lowest … K, A, 2 highest; within a rank diamonds < clubs < hearts <
// spades. A card's power is its place in that order, 0 (3 of diamonds) to 51 (2 of spades).
import { rankOf, suitOf, type Card, type Rank, type Suit } from '../../lib/cards/deck';

const SUIT_ORDER: readonly Suit[] = ['diamonds', 'clubs', 'hearts', 'spades'];

/** A rank's place, 0 (three) to 12 (two). */
export const rankPower = (r: Rank): number => (r + 10) % 13;
export const suitPower = (c: Card): number => SUIT_ORDER.indexOf(suitOf(c));
export const power = (c: Card): number => rankPower(rankOf(c)) * 4 + suitPower(c);

/** A hand in Big 2 order, lowest first. */
export const sortBig2 = (cards: readonly Card[]): Card[] => [...cards].sort((a, b) => power(a) - power(b));

/** The lowest card of a pile. */
export const lowest = (cards: readonly Card[]): Card => sortBig2(cards)[0];
