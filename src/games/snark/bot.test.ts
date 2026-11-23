import { describe, expect, it } from 'vitest';
import { seeded } from '../../lib/room/bots';
import { snarkBrain } from './bot';
import { readToHost } from './protocol';
import type { PlayerView, Screen } from './view';

const view = (screen: Screen, paused = false): PlayerView => ({
  code: 'BCDF', round: 1, rounds: 3, final: false, me: { name: '🤖 Ada', color: 0, score: 0 }, screen, left: 60000, span: 75000, paused,
});
const decide = (v: PlayerView) => snarkBrain().decide({ view: v, me: 'b1', left: v.left, rand: seeded(7), mem: {} });

describe('Snark Tank bot', () => {
  it('sends the stock answer when the prompt has one, before the timer ends', () => {
    const plan = decide(view({ k: 'write', tasks: [{ i: 2, prompt: 'A bad boat name', safety: 'Unsinkable II' }], total: 2 }))!;
    expect(plan.wait).toBeGreaterThan(1000);
    expect(plan.wait).toBeLessThan(60000);
    expect(plan.act()).toEqual([{ t: 'answer', r: 1, i: 2, text: 'Unsinkable II' }]);
    const other = decide(view({ k: 'write', tasks: [{ i: 3, prompt: 'A bad boat name' }], total: 2 }))!.act()[0] as { text: string };
    expect(readToHost({ ...other })).not.toBeNull();
    expect(other.text.length).toBeGreaterThan(0);
  });

  it('writes three lines in a three-line duel', () => {
    const [m] = decide(view({ k: 'write', tasks: [{ i: 0, prompt: 'Three things' }], total: 1, lines: true }))!.act() as { lines: string[] }[];
    expect(m.lines).toHaveLength(3);
    expect(readToHost(m)).not.toBeNull();
  });

  it('votes for an answer that exists, never its own prompt; three votes in the final', () => {
    const choices = [{ id: 'a' as const, text: 'x', empty: true }, { id: 'b' as const, text: 'y', empty: false }];
    expect(decide(view({ k: 'vote', at: 4, prompt: 'p', choices, own: false, voted: null }))!.act()).toEqual([{ t: 'vote', r: 1, at: 4, c: 'b' }]);
    expect(decide(view({ k: 'vote', at: 4, prompt: 'p', choices, own: true, voted: null }))).toBeNull();
    const [m] = decide(view({ k: 'vote3', at: 0, prompt: 'p', choices: [{ id: 1, text: 'a' }, { id: 2, text: 'b' }], own: true, sent: false }))!.act() as { v: Record<string, number> }[];
    expect(Object.values(m.v).reduce((a, b) => a + b, 0)).toBe(3);
    expect(Object.keys(m.v).every((k) => k === '1' || k === '2')).toBe(true);
  });
});
