import { describe, expect, it } from 'vitest';
import { seeded } from '../../lib/room/bots';
import { cardOf } from '../../lib/cards/deck';
import * as L from './logic';
import { view } from './view';

function dealt() {
  let g = L.newGame('g', 'BCDF', L.DEFAULT_SETTINGS);
  for (const pid of ['a', 'b', 'c']) g = (L.join(g, pid, pid.toUpperCase(), new Set()) as { game: L.Game }).game;
  return L.start(g, 0, seeded(9));
}

describe('Go Fish views', () => {
  it("carry a phone's own hand and nobody else's cards, nor the pool's order", () => {
    const g = dealt();
    const a = view(g, 1, 'a');
    expect(a.hand).toEqual(g.hands.a);
    expect(view(g, 1).hand).toBeUndefined();
    expect(a.players.map((p) => [p.pid, p.cards])).toEqual(g.seats.map((p) => [p, g.hands[p].length]));
    expect(a.pool).toBe(g.pool.length);
    const text = JSON.stringify(a);
    for (const card of [...g.hands.b, ...g.hands.c, ...g.pool]) expect(text).not.toMatch(new RegExp(`[[,]${card}[\\],]`));
    expect(text).not.toMatch(/hands|"deck"/);
  });

  it('show the card drawn only to the phone that drew it', () => {
    const g0 = dealt();
    const rigged = L.begin({ ...g0, hands: { a: [cardOf(7, 'spades')], b: [cardOf(9, 'hearts')], c: [cardOf(4, 'clubs')] }, pool: [cardOf(13, 'spades')], books: {} }, 'a', 0);
    const g = L.ask(rigged, 'a', rigged.at, 'b', 7, 1);
    expect(view(g, 1, 'a').drew).toBe(cardOf(13, 'spades'));
    expect([view(g, 1).drew, view(g, 1, 'b').drew]).toEqual([undefined, undefined]);
  });
});
