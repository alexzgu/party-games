import { describe, expect, it } from 'vitest';
import { seeded } from '../../lib/room/bots';
import { apply, type Delta } from './live';
import { readToHost } from './protocol';
import { fits, sketchBrain } from './bot';
import type { Drawing } from '../../lib/ink';
import type { View } from './view';

const base: View = { mode: 'guess', phase: 'guess', at: 4, left: 70000, total: 80000, paused: false, players: [], packs: ['classic'] };

describe('Sketchy bot', () => {
  it('does its Telephone step: a line, a doodle', () => {
    const brain = sketchBrain();
    const look = (task: View['task']) => ({ view: { ...base, mode: 'telephone' as const, phase: 'write' as const, task }, me: 'b1', left: 40000, rand: seeded(1), mem: {} });
    expect(readToHost(brain.decide(look({ id: 't1', kind: 'write' }))!.act()[0])).toMatchObject({ t: 'line', at: 4 });
    expect(readToHost(brain.decide(look({ id: 't2', kind: 'draw', line: 'A cat' }))!.act()[0])).toMatchObject({ t: 'draw', at: 4 });
  });

  it('as drawer streams its doodle so the host rebuilds it stroke by stroke', () => {
    const brain = sketchBrain();
    const mem = {};
    const view = { ...base, drawer: 'b1', ink: 'g/1/0' };
    let host: Drawing = [];
    for (let k = 0; k < 20; k++) {
      const plan = brain.decide({ view, me: 'b1', left: 70000, rand: seeded(2), mem });
      if (!plan) break;
      const m = readToHost(plan.act()[0]) as { t: 'ink'; n: number } & ({ all: Drawing } | Delta);
      expect(m.n).toBe(k + 1);
      host = 'all' in m ? m.all : apply(host, m)!;
      expect(host).not.toBeNull();
    }
    expect(host.length).toBeGreaterThanOrEqual(3);
    // The host missed some: it asks, and gets the whole drawing.
    brain.hear!({ t: 'ink?' }, mem);
    expect(brain.decide({ view, me: 'b1', left: 70000, rand: seeded(2), mem })!.act()[0]).toMatchObject({ all: host });
  });

  it('guesses words that fit the shape and letters shown, a few per turn', () => {
    expect(fits('Ice cream', '__e _____')).toBe(true);
    expect(fits('Ice cream', '__a _____')).toBe(false);
    expect(fits('Cat', '____')).toBe(false);
    const brain = sketchBrain();
    const mem = {};
    const view = { ...base, drawer: 'x', ink: 'g/1/0', guessing: true, shape: '___' };
    const sent: string[] = [];
    for (let k = 0; k < 10; k++) {
      const plan = brain.decide({ view, me: 'b1', left: 70000, rand: seeded(k), mem });
      if (!plan) break;
      expect(plan.wait).toBeGreaterThanOrEqual(1000);
      sent.push((plan.act()[0] as { text: string }).text);
    }
    expect(sent.length).toBe(4);
    expect(sent.every((w) => [...w].length === 3)).toBe(true);
    expect(brain.decide({ view: { ...view, guessing: false }, me: 'b1', left: 70000, rand: seeded(1), mem: {} })).toBeNull();
  });
});
