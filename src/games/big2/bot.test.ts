import { describe, expect, it } from 'vitest';
import { seeded } from '../../lib/room/bots';
import { cardList as cards } from '../../lib/cards/notation';
import { big2Brain } from './bot';
import { readToHost } from './protocol';
import type { View } from './view';

const base: View = {
  phase: 'turn', at: 5, left: 25000, total: 30000, paused: false, deal: 1, deals: 3, scored: 0, turn: 'b1', log: [],
  players: [{ pid: 'b1', name: '🤖 Ada', cards: 3, points: 0 }, { pid: 'p1', name: 'Sam', cards: 4, points: 0 }],
  hand: cards('4c 9h 9s'),
};
const decide = (v: Partial<View>) => big2Brain().decide({ view: { ...base, ...v }, me: 'b1', left: 25000, rand: seeded(3), mem: {} });
const move = (v: Partial<View>) => decide(v)!.act()[0];

describe('Big 2 bot', () => {
  it('on its own turn, after a short wait, leads its lowest card, beats the table as cheaply as it can, or passes', () => {
    const plan = decide({})!;
    expect([plan.wait >= 1000, plan.wait < 25000]).toEqual([true, true]);
    expect(move({})).toEqual({ t: 'play', at: 5, cards: cards('4c') });
    expect(move({ table: { by: 'p1', cards: cards('5d 5s'), kind: 'pair' } })).toEqual({ t: 'play', at: 5, cards: cards('9h 9s') });
    expect(move({ table: { by: 'p1', cards: cards('2d'), kind: 'single' } })).toEqual({ t: 'pass', at: 5 });
    expect([decide({ turn: 'p1' }), decide({ phase: 'result' })]).toEqual([null, null]);
  });

  it('sends only messages the host reads as sent, and the host refuses anything else', () => {
    for (const m of [move({}), move({ table: { by: 'p1', cards: cards('2d'), kind: 'single' } })]) expect(readToHost(m)).toEqual(m);
    expect([readToHost({ t: 'play', at: 5, cards: [] }), readToHost({ t: 'play', at: 5, cards: [52] }), readToHost({ t: 'pass', at: 0 }), readToHost({ t: 'ask', at: 5 })])
      .toEqual([null, null, null, null]);
  });
});
