import { describe, expect, it } from 'vitest';
import { seeded } from '../../lib/room/bots';
import { cardOf, sortHand, type Card } from '../../lib/cards/deck';
import * as L from './logic';
import { view, type View } from './view';

function dealt() {
  let g = L.newGame('g', 'BCDF', L.DEFAULT_SETTINGS);
  for (const pid of ['a', 'b', 'c']) g = (L.join(g, pid, pid.toUpperCase(), new Set()) as { game: L.Game }).game;
  return L.start(g, 0, seeded(9));
}

/** The fields each part of a view may have: only `hand` and `drew` hold cards. */
const VIEW = ['phase', 'at', 'left', 'total', 'paused', 'players', 'pool', 'turn', 'next', 'shown', 'log', 'hand', 'drew'];
const SEAT = ['pid', 'name', 'cards', 'books', 'out', 'watching'];
const EVENT = ['n', 'k', 'by', 'from', 'rank', 'got', 'why'];

/** Every card a view shows: its own hand and the card it just drew; nothing else in it is a card. */
function cardsIn(v: View): Card[] {
  expect(Object.keys(v).every((k) => VIEW.includes(k))).toBe(true);
  for (const p of v.players) {
    expect(Object.keys(p).every((k) => SEAT.includes(k))).toBe(true);
    expect(typeof p.cards).toBe('number');
  }
  for (const e of [...v.log, ...(v.shown ?? [])]) expect(Object.keys(e).every((k) => EVENT.includes(k))).toBe(true);
  expect(typeof v.pool).toBe('number');
  return [...(v.hand ?? []), ...(v.drew === undefined ? [] : [v.drew])];
}

describe('Go Fish views', () => {
  it("carry a phone's own hand and nobody else's cards, nor the pool's order", () => {
    const g = dealt();
    const a = view(g, 1, 'a');
    expect(a.hand).toEqual(sortHand(g.hands.a));
    expect(view(g, 1).hand).toBeUndefined();
    expect(a.players.map((p) => [p.pid, p.cards])).toEqual(g.seats.map((p) => [p, g.hands[p].length]));
    expect(a.pool).toBe(g.pool.length);
    expect(cardsIn(a).sort()).toEqual([...g.hands.a].sort());
    expect(cardsIn(view(g, 1))).toEqual([]);
  });

  it('show the card drawn only to the phone that drew it', () => {
    const g0 = dealt();
    const rigged = L.begin({ ...g0, hands: { a: [cardOf(7, 'spades')], b: [cardOf(9, 'hearts')], c: [cardOf(4, 'clubs')] }, pool: [cardOf(13, 'spades')], books: {} }, 'a', 0);
    const g = L.ask(rigged, 'a', rigged.at, 'b', 7, 1);
    expect(view(g, 1, 'a').drew).toBe(cardOf(13, 'spades'));
    expect([view(g, 1).drew, view(g, 1, 'b').drew]).toEqual([undefined, undefined]);
  });

  it('send a hand sorted by rank, also after cards are received', () => {
    const g0 = dealt();
    const rigged = L.begin({ ...g0, hands: { a: [cardOf(13, 'spades'), cardOf(7, 'clubs')], b: [cardOf(7, 'hearts'), cardOf(2, 'clubs')], c: [cardOf(4, 'clubs')] }, pool: [cardOf(1, 'spades')], books: {} }, 'a', 0);
    const g = L.ask(rigged, 'a', rigged.at, 'b', 7, 1);
    expect(view(g, 1, 'a').hand).toEqual([cardOf(7, 'hearts'), cardOf(7, 'clubs'), cardOf(13, 'spades')]);
  });

  it('never show anyone a card that is not theirs, in the hand, the drawn card or any event, over a whole game', () => {
    const rand = seeded(31);
    let g = dealt();
    for (let t = 1; g.phase !== 'over' && t < 3000; t++) {
      for (const pid of g.seats) {
        const own = new Set([...L.hand(g, pid), ...(g.turn === pid && g.phase === 'show' && g.drew !== null ? [g.drew] : [])]);
        expect(cardsIn(view(g, t, pid)).every((c) => own.has(c))).toBe(true);
      }
      expect(cardsIn(view(g, t))).toEqual([]);
      // A drawn card's rank is told only when it was the rank asked for.
      for (const [i, e] of g.shown.entries()) if (e.k === 'drew' && e.rank) expect(g.shown[i - 1]).toMatchObject({ k: 'asked', rank: e.rank, got: 0 });
      g = L.step(g, t, rand);
    }
    expect(g.phase).toBe('over');
  });
});
