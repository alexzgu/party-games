// Fixed screens for `#/big2/host?demo=<key>` and `#/big2/join?demo=<key>`: every phase without a
// room. Host: lobby|turn|lead|result|over|paused, and `full`, a table of four 20-character names.
// Phone: join|wait|turn|lead|picked|watching|result|over, and `full`, a hand of 13 cards on turn.
// The phone is Jules (`a`).
import { cardList } from '../../lib/cards/notation';
import { sortBig2 } from './order';
import type { Event } from './state';
import type { Seat, View } from './view';

const LONG = ['Christopher Halloway', 'Jacqueline Westbrook', 'Kensington Blackwood', 'Bartholomew Winthrop'];
const short: Seat[] = [
  { pid: 'a', name: 'Jules', cards: 9, points: 4 }, { pid: 'b', name: 'Cam', cards: 6, points: 0, passed: true },
  { pid: 'c', name: 'Rae', cards: 11, points: 12 }, { pid: 'd', name: 'Sage', cards: 7, points: 3 },
];
const full: Seat[] = LONG.map((name, i) => ({ pid: i ? `f${i}` : 'a', name, cards: [13, 12, 13, 10][i], points: [24, 3, 0, 39][i] }));
const hand = sortBig2(cardList('4c 6d 6h 8s 9c 10d Jh Ah 2c'));
const thirteen = sortBig2(cardList('3c 4d 5h 6s 7c 8d 9h 10s Jc Qd Kh As 2d'));
const pair = sortBig2(cardList('7d 7s'));

/** The last few events of a trick between the table's fourth, first, second and third players. */
const trick = (p: readonly Seat[]): Event[] => [
  { n: 21, k: 'lead', by: p[3].pid }, { n: 22, k: 'play', by: p[3].pid, cards: cardList('5d 5c') },
  { n: 23, k: 'pass', by: p[0].pid }, { n: 24, k: 'play', by: p[1].pid, cards: cardList('6c 6s') },
  { n: 25, k: 'play', by: p[2].pid, cards: pair },
];
const result = { out: 'b', rows: [{ pid: 'a', cards: 4, points: 4 }, { pid: 'b', cards: 0, points: 0 }, { pid: 'c', cards: 12, points: 24 }, { pid: 'd', cards: 1, points: 1 }] };

export function demo(key: string, phone: boolean): View {
  const base = { at: 3, paused: key === 'paused', deal: 2, deals: 3, log: trick(key === 'full' ? full : short) };
  if (key === 'lobby' || key === 'wait') return { ...base, phase: 'lobby', left: null, total: 0, deal: 0, players: short.map((p) => ({ pid: p.pid, name: p.name, cards: 0, points: 0 })), log: [] };
  if (key === 'result') return { ...base, phase: 'result', left: 7000, total: 10_000, players: short.map((p) => ({ ...p, passed: undefined })), result };
  if (key === 'over') {
    const players = [...short].sort((x, y) => x.points - y.points).map((p) => ({ ...p, passed: undefined }));
    return { ...base, deal: 3, phase: 'over', left: null, total: 0, players, result };
  }
  const players = key === 'full' ? full : key === 'watching' ? [...short.slice(1), { pid: 'a', name: 'Jules', cards: 0, points: 0, watching: 'game' as const }] : short;
  const leading = key === 'lead';
  const turn = ['turn', 'picked', 'full', 'paused', 'lead'].includes(key) ? 'a' : 'd';
  const mine = phone && key !== 'watching' ? { hand: key === 'full' ? thirteen : hand } : {};
  const table = leading ? {} : { table: { by: key === 'full' ? 'f2' : 'c', cards: pair, kind: 'pair' as const } };
  return { ...base, phase: 'turn', left: 21_000, total: 30_000, players: leading ? players.map((p) => ({ ...p, passed: undefined })) : players, turn, ...table, ...mine };
}

/** The phone demo `picked`: two cards already tapped (a pair of sixes, which does not beat the sevens on the table). */
export const demoPick = (key: string | null) => (key === 'picked' ? cardList('6d 6h') : []);
