// Fixed screens for `#/fish/host?demo=<key>` and `#/fish/join?demo=<key>`: every phase without a
// room. Host: lobby|turn|gave|fish|book|over|paused, and `full`, a table of six 20-character names.
// Phone: join|wait|turn|picked|watching|over, and `full`, a hand of 25 cards. The phone is Jules (`a`).
import { cardOf, sortHand, SUITS, type Card } from '../../lib/cards/deck';
import type { Event } from './state';
import type { Seat, View } from './view';

const LONG = ['Christopher Halloway', 'Jacqueline Westbrook', 'Kensington Blackwood', 'Bartholomew Winthrop', 'Alexandria Fairbanks', 'Dominique Ashborough'];
const short: Seat[] = [
  { pid: 'a', name: 'Jules', cards: 6, books: [4] }, { pid: 'b', name: 'Cam', cards: 4, books: [] },
  { pid: 'c', name: 'Rae', cards: 7, books: [11, 2] }, { pid: 'd', name: 'Sage', cards: 3, books: [] },
];
const full: Seat[] = LONG.map((name, i) => ({ pid: i ? `f${i}` : 'a', name, cards: [25, 3, 9, 1, 6, 0][i], books: [[1, 5], [9], [12, 13, 3], [], [7, 8, 10], [2]][i] }));
const cards = (...list: [number, (typeof SUITS)[number]][]): Card[] => sortHand(list.map(([r, s]) => cardOf(r, s)));
const hand = cards([1, 'spades'], [7, 'hearts'], [7, 'clubs'], [9, 'diamonds'], [12, 'hearts'], [13, 'spades']);
/** 25 cards: no rank four times. */
const big = sortHand(Array.from({ length: 25 }, (_, i) => i));

/** The last few events, between the table's third (`c`), fourth (`d`) and first (`a`) players. */
const before = (p: readonly Seat[]): Event[] => [
  { n: 5, k: 'asked', by: p[2].pid, from: p[3].pid, rank: 2, got: 1 },
  { n: 6, k: 'book', by: p[2].pid, rank: 2 },
  { n: 7, k: 'asked', by: p[2].pid, from: 'a', rank: 9, got: 0 },
  { n: 8, k: 'drew', by: p[2].pid, why: 'fish' },
];
const shown: Record<string, Event[]> = {
  gave: [{ n: 9, k: 'asked', by: 'a', from: 'b', rank: 7, got: 2 }],
  fish: [{ n: 9, k: 'asked', by: 'a', from: 'b', rank: 7, got: 0 }, { n: 10, k: 'drew', by: 'a', why: 'fish', rank: 7 }],
  book: [{ n: 9, k: 'asked', by: 'a', from: 'b', rank: 7, got: 2 }, { n: 10, k: 'book', by: 'a', rank: 7 }],
};

export function demo(key: string, phone: boolean): View {
  const base = { at: 3, paused: key === 'paused', pool: 18, log: before(short) };
  if (key === 'lobby' || key === 'wait') return { ...base, phase: 'lobby', left: null, total: 0, players: short.map((p) => ({ ...p, cards: 0, books: [] })), pool: 0, log: [] };
  if (key === 'over') {
    const players = [...short].sort((x, y) => y.books.length - x.books.length).map((p, i) => ({ ...p, cards: 0, books: [[11, 2, 6, 8, 1], [4, 9, 13, 5], [3, 10], [12, 7]][i] }));
    return { ...base, phase: 'over', left: null, total: 0, players, pool: 0 };
  }
  const players = key === 'full' ? full : key === 'watching' ? [...short.slice(1), { pid: 'a', name: 'Jules', cards: 0, books: [], watching: true as const }] : short;
  const log = before(key === 'watching' ? short : players);
  const mine = key === 'watching' || !phone ? {} : { hand: key === 'full' ? big : key === 'book' ? hand.filter((c) => c % 13 !== 6) : key === 'gave' || key === 'fish' ? sortHand([...hand, cardOf(7, 'diamonds')]) : hand };
  if (shown[key]) return { ...base, phase: 'show', left: 2000, total: 3000, players, turn: 'a', next: key === 'fish' || key === 'gave' || key === 'book' ? 'a' : 'b', shown: shown[key], log: [...log, ...shown[key]].slice(-8), ...mine, ...(phone && key === 'fish' ? { drew: cardOf(7, 'diamonds') } : {}) };
  const turn = key === 'turn' || key === 'picked' || key === 'full' || key === 'paused' ? 'a' : 'c';
  return { ...base, phase: 'turn', left: 21_000, total: 30_000, players, turn, log, ...mine };
}

/** The phone demo `picked`: a rank and a player already tapped. */
export const demoPick = (key: string | null) => (key === 'picked' ? { rank: 7, to: 'c' } : null);
