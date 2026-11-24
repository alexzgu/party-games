import { describe, expect, it } from 'vitest';
import { seeded } from '../../lib/room/bots';
import { ratherBrain } from './bot';
import { readToHost } from './protocol';
import type { View } from './view';

const base: View = {
  phase: 'vote', at: 5, n: 2, count: 10, left: 15000, total: 20000, paused: false, prompt: 'fly or swim',
  players: [{ pid: 'b1', name: '🤖 Ada', score: 0 }],
};
const decide = (v: Partial<View>, seed = 3) => ratherBrain().decide({ view: { ...base, ...v }, me: 'b1', left: 15000, rand: seeded(seed), mem: {} });

describe('Would You Rather bot', () => {
  it('votes on the question in play after a short wait, once', () => {
    const plan = decide({})!;
    expect(plan.wait).toBeGreaterThanOrEqual(1000);
    expect(plan.wait).toBeLessThan(15000);
    const [m] = plan.act();
    expect(readToHost(m)).toEqual({ t: 'vote', at: 5, n: 2, side: (m as { side: number }).side });
    expect(decide({ mine: 1 })).toBeNull();
    expect(decide({ phase: 'reveal' })).toBeNull();
  });

  it('picks either side at random', () => {
    const sides = new Set(Array.from({ length: 20 }, (_, i) => (decide({}, i)!.act()[0] as { side: number }).side));
    expect([...sides].sort()).toEqual([0, 1]);
  });
});
