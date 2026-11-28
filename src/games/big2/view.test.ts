import { describe, expect, it } from 'vitest';
import { seeded } from '../../lib/room/bots';
import type { Card } from '../../lib/cards/deck';
import { choose } from './bot';
import { sortBig2 } from './order';
import * as L from './logic';
import { view, type View } from './view';

function dealt(n = 3) {
  let g = L.newGame('g', 'BCDF', L.DEFAULT_SETTINGS);
  for (let i = 0; i < n; i++) g = (L.join(g, `p${i}`, `P${i}`, new Set()) as { game: L.Game }).game;
  return L.start(g, 0, seeded(9));
}

/** The fields each part of a view may have: only `hand`, `table`, `first` and events' plays hold cards. */
const VIEW = ['phase', 'at', 'left', 'total', 'paused', 'deal', 'deals', 'scored', 'players', 'turn', 'table', 'first', 'result', 'log', 'hand'];
const SEAT = ['pid', 'name', 'cards', 'points', 'passed', 'out', 'watching'];

/** Every hidden card a view shows: its own hand; the table, first card and events are face up for everyone. */
function hidden(v: View): Card[] {
  expect(Object.keys(v).every((k) => VIEW.includes(k))).toBe(true);
  for (const p of v.players) expect([Object.keys(p).every((k) => SEAT.includes(k)), typeof p.cards]).toEqual([true, 'number']);
  return v.hand ?? [];
}

describe('Big 2 views', () => {
  it("carry a phone's own hand in Big 2 order and nobody else's, nor the set-aside cards", () => {
    const g = dealt();
    const a = view(g, 1, 'p0');
    expect(a.hand).toEqual(sortBig2(g.hands.p0));
    expect([view(g, 1).hand, a.players.map((p) => p.cards)]).toEqual([undefined, [13, 13, 13]]);
    expect(JSON.stringify(a)).not.toMatch(/aside|deck|rest/);
  });

  it('never show anyone a card that is not theirs or face up on the table, over whole games', () => {
    for (const n of [2, 4]) {
      let g = dealt(n);
      for (let t = 1; g.phase !== 'over' && t < 3000; t++) {
        const played = new Set(g.log.flatMap((e) => (e.k === 'play' ? e.cards : [])));
        for (const pid of g.seats) expect(hidden(view(g, t, pid)).every((c) => L.hand(g, pid).includes(c))).toBe(true);
        expect(hidden(view(g, t))).toEqual([]);
        const v = view(g, t);
        if (v.table) expect(v.table.cards.every((c) => played.has(c))).toBe(true);
        if (g.phase === 'turn') {
          const m = choose(view(g, t, g.turn!))!;
          g = m.t === 'play' ? L.play(g, g.turn!, g.at, m.cards, t) : L.pass(g, g.turn!, g.at, t);
        } else g = L.step(g, t, seeded(t));
      }
      expect(g.phase).toBe('over');
    }
  });
});
