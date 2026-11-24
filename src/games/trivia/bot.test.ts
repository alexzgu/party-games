import { describe, expect, it } from 'vitest';
import { seeded } from '../../lib/room/bots';
import { BOT_RIGHT, triviaBrain } from './bot';
import { readToHost } from './protocol';
import type { View } from './view';

const base: View = {
  phase: 'answer', at: 5, n: 2, count: 10, left: 20000, total: 20000, paused: false, category: 'Science',
  question: 'What gas do plants take in from the air?', answers: ['Oxygen', 'Carbon dioxide', 'Helium', 'Nitrogen'],
  players: [{ pid: 'b1', name: '🤖 Ada', score: 0 }],
};
const decide = (v: Partial<View>, seed = 3) => triviaBrain((n) => (n === 2 ? 1 : null)).decide({ view: { ...base, ...v }, me: 'b1', left: v.left ?? 20000, rand: seeded(seed), mem: {} });

describe('Smarty Pants bot', () => {
  it('answers the question in play after 2 to 8 seconds, once', () => {
    const plan = decide({})!;
    expect(plan.wait).toBeGreaterThanOrEqual(2000);
    expect(plan.wait).toBeLessThanOrEqual(8000);
    expect(decide({ left: 4000 })!.wait).toBeLessThanOrEqual(3200); // never past the timer
    const [m] = plan.act();
    expect(m).toMatchObject({ t: 'answer', at: 5, n: 2 });
    expect(readToHost(m)).toEqual(m); // the host reads it as sent, nothing dropped or added
    expect(decide({ mine: 1 })).toBeNull();
    expect(decide({ phase: 'category', answers: undefined })).toBeNull();
    expect(decide({ phase: 'reveal' })).toBeNull();
  });

  it('is right about 55% of the time, and wrong answers vary', () => {
    const picks = Array.from({ length: 2000 }, (_, i) => (decide({}, i)!.act()[0] as { choice: number }).choice);
    const right = picks.filter((c) => c === 1).length / picks.length;
    expect(Math.abs(right - BOT_RIGHT)).toBeLessThan(0.04);
    expect(new Set(picks)).toEqual(new Set([0, 1, 2, 3]));
  });
});
