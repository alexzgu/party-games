// A standard 52-card deck as plain numbers, for any card game. A card is its id 0–51: suit
// `Math.floor(id / 13)` (spades, hearts, diamonds, clubs) and rank `id % 13 + 1` (1 ace … 13 king).
// The first card of a pile is its top.
import { shuffle } from '../random';

export type Card = number;
/** 1 is the ace, 11 jack, 12 queen, 13 king. */
export type Rank = number;
export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export type Suit = (typeof SUITS)[number];
export const RANKS = 13;
export const DECK_SIZE = 52;

export const rankOf = (c: Card): Rank => (c % RANKS) + 1;
export const suitOf = (c: Card): Suit => SUITS[Math.floor(c / RANKS)];
export const cardOf = (rank: Rank, suit: Suit): Card => SUITS.indexOf(suit) * RANKS + rank - 1;
export const isCard = (x: unknown): x is Card => Number.isInteger(x) && (x as number) >= 0 && (x as number) < DECK_SIZE;
export const isRank = (x: unknown): x is Rank => Number.isInteger(x) && (x as number) >= 1 && (x as number) <= RANKS;
export const isRed = (c: Card): boolean => suitOf(c) === 'hearts' || suitOf(c) === 'diamonds';

/** The 52 cards in order. */
export const newDeck = (): Card[] => Array.from({ length: DECK_SIZE }, (_, i) => i);

/** A new deck, shuffled with `rand` (the app's random numbers unless a test gives its own). */
export const shuffledDeck = (rand: () => number = Math.random): Card[] => shuffle(newDeck(), rand);

/** Deals `each` cards to `hands` players one at a time around the table, from the top; the rest stays a pile. */
export function deal(deck: readonly Card[], hands: number, each: number): { hands: Card[][]; rest: Card[] } {
  const out: Card[][] = Array.from({ length: hands }, () => []);
  const n = Math.min(deck.length, hands * each);
  for (let i = 0; i < n; i++) out[i % hands].push(deck[i]);
  return { hands: out, rest: deck.slice(n) };
}

/** A hand sorted by rank (ace low), then suit. */
export const sortHand = (cards: readonly Card[]): Card[] =>
  [...cards].sort((a, b) => rankOf(a) - rankOf(b) || Math.floor(a / RANKS) - Math.floor(b / RANKS));

const SHORT = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const WORD = ['ace', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king'];
const PLURAL = ['aces', 'twos', 'threes', 'fours', 'fives', 'sixes', 'sevens', 'eights', 'nines', 'tens', 'jacks', 'queens', 'kings'];
export const SYMBOLS: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };

/** "A", "7", "10", "K": what a card's corner shows. */
export const rankLabel = (r: Rank): string => SHORT[r - 1];
/** "ace", "seven", "king". */
export const rankWord = (r: Rank): string => WORD[r - 1];
/** "aces", "sevens", "sixes". */
export const rankPlural = (r: Rank): string => PLURAL[r - 1];
/** "7 of hearts", "ace of spades", "queen of clubs". */
export const cardName = (c: Card): string => {
  const r = rankOf(c);
  return `${r === 1 || r > 10 ? WORD[r - 1] : r} of ${suitOf(c)}`;
};
