// What a set of cards is as a Big 2 play, and whether one play beats another. Legal plays: a
// single, a pair, three of a kind, or a five-card hand: straight < flush < full house < four of a
// kind plus any one card < straight flush. Straights run 3-4-5-6-7 up to 10-J-Q-K-A; a 2 is never
// in a straight (*house*).
import { rankOf, suitOf, type Card } from '../../lib/cards/deck';
import { power, rankPower, sortBig2, suitPower } from './order';

export type Kind = 'single' | 'pair' | 'triple' | 'straight' | 'flush' | 'full' | 'four' | 'sflush';
/** A play: its kind, its cards lowest first, and what it is compared by (higher wins, first number first). */
export type Combo = { kind: Kind; cards: Card[]; key: number[] };

/** Five-card hands, weakest kind first: a higher kind beats any of a lower one. */
const FIVES: readonly Kind[] = ['straight', 'flush', 'full', 'four', 'sflush'];

/** How many cards of each rank power, most first. */
function groups(cards: readonly Card[]): { rank: number; n: number }[] {
  const n = new Map<number, number>();
  for (const c of cards) n.set(rankPower(rankOf(c)), (n.get(rankPower(rankOf(c))) ?? 0) + 1);
  return [...n].map(([rank, k]) => ({ rank, n: k })).sort((a, b) => b.n - a.n || b.rank - a.rank);
}

function five(cards: Card[]): Combo | null {
  const top = power(cards[4]);
  const ranks = cards.map((c) => rankPower(rankOf(c)));
  const straight = ranks.every((r, i) => i === 0 || r === ranks[i - 1] + 1) && ranks[4] <= rankPower(1);
  const flush = cards.every((c) => suitOf(c) === suitOf(cards[0]));
  if (straight && flush) return { kind: 'sflush', cards, key: [top] };
  const g = groups(cards);
  if (g[0].n === 4) return { kind: 'four', cards, key: [g[0].rank] };
  if (g[0].n === 3 && g[1].n === 2) return { kind: 'full', cards, key: [g[0].rank] };
  if (flush) return { kind: 'flush', cards, key: [...ranks].reverse().concat(suitPower(cards[4])) };
  if (straight) return { kind: 'straight', cards, key: [top] };
  return null;
}

/** The play these cards make, or null when they make none. */
export function classify(selection: readonly Card[]): Combo | null {
  const cards = sortBig2(selection);
  const same = cards.every((c) => rankOf(c) === rankOf(cards[0]));
  const top = power(cards[cards.length - 1]);
  if (cards.length === 1) return { kind: 'single', cards, key: [top] };
  if (cards.length === 2 && same) return { kind: 'pair', cards, key: [top] };
  if (cards.length === 3 && same) return { kind: 'triple', cards, key: [top] };
  return cards.length === 5 ? five(cards) : null;
}

const higher = (a: readonly number[], b: readonly number[]): boolean => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};

/** Whether `a` beats `b`: the same number of cards, then a higher five-card kind, or the same kind and higher. */
export function beats(a: Combo, b: Combo): boolean {
  if (a.cards.length !== b.cards.length) return false;
  if (a.kind !== b.kind) return a.cards.length === 5 && FIVES.indexOf(a.kind) > FIVES.indexOf(b.kind);
  return higher(a.key, b.key);
}
