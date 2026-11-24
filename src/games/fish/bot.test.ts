import { describe, expect, it } from 'vitest';
import { seeded } from '../../lib/room/bots';
import { cardOf } from '../../lib/cards/deck';
import { fishBrain } from './bot';
import { readToHost } from './protocol';
import type { Event } from './state';
import type { View } from './view';

const seven = cardOf(7, 'hearts');
const nine = cardOf(9, 'clubs');
const base: View = {
  phase: 'turn', at: 5, left: 25000, total: 30000, paused: false, pool: 20, turn: 'b1', log: [],
  players: [{ pid: 'b1', name: '🤖 Ada', cards: 2, books: [] }, { pid: 'p1', name: 'Sam', cards: 4, books: [] },
    { pid: 'p2', name: 'Maya', cards: 3, books: [] }, { pid: 'p3', name: 'Lee', cards: 0, books: [] }],
  hand: [seven, nine],
};
const decide = (v: Partial<View>, seed = 3, mem: Record<string, unknown> = {}) =>
  fishBrain().decide({ view: { ...base, ...v }, me: 'b1', left: 25000, rand: seeded(seed), mem });
const asked = (v: Partial<View>, seed = 3) => decide(v, seed)!.act()[0] as { t: string; at: number; to: string; rank: number };

describe('Go Fish bot', () => {
  it('asks on its own turn after a short wait for a rank it holds from a player with cards, and the host reads it as sent', () => {
    const plan = decide({})!;
    expect(plan.wait).toBeGreaterThanOrEqual(1000);
    expect(plan.wait).toBeLessThan(25000);
    for (let s = 0; s < 20; s++) {
      const m = asked({}, s);
      expect([[7, 9].includes(m.rank), ['p1', 'p2'].includes(m.to), m.at]).toEqual([true, true, 5]);
      expect(readToHost(m)).toEqual(m);
    }
    expect(decide({ turn: 'p1' })).toBeNull();
    expect(decide({ phase: 'show' })).toBeNull();
  });

  it('asks a player it saw ask for or receive a rank it holds, unless they gave it away or laid it down since', () => {
    const log: Event[] = [{ n: 1, k: 'asked', by: 'p2', from: 'p1', rank: 9, got: 1 }];
    for (let s = 0; s < 10; s++) expect(asked({ log }, s)).toMatchObject({ to: 'p2', rank: 9 });
    const since: Event[] = [...log, { n: 2, k: 'book', by: 'p2', rank: 9 }];
    expect(new Set(Array.from({ length: 20 }, (_, s) => asked({ log: since }, s).to))).toEqual(new Set(['p1', 'p2']));
  });
});
