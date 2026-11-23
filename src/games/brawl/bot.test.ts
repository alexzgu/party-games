import { describe, expect, it } from 'vitest';
import { seeded } from '../../lib/room/bots';
import { brawlBrain } from './bot';
import { readToHost } from './protocol';
import type { View } from './view';

const base: View = { phase: 'draw', at: 3, round: 1, left: 80000, total: 90000, paused: false, players: [] };
const decide = (v: Partial<View>) => brawlBrain().decide({ view: { ...base, ...v }, me: 'b1', left: v.left ?? 80000, rand: seeded(11), mem: {} });

describe('Doodle Brawl bot', () => {
  it('draws and names a fighter the host accepts, before the timer', () => {
    const plan = decide({ draw: { id: 'f1', opponent: null }, title: 'World\'s okayest roommate' })!;
    expect(plan.wait).toBeLessThan(80000);
    expect(readToHost(plan.act()[0])).toMatchObject({ t: 'draw', at: 3 });
    expect(decide({})).toBeNull();
  });

  it('votes when asked and keeps or tags in a shown fighter', () => {
    expect(readToHost(decide({ phase: 'vote', vote: true })!.act()[0])).toMatchObject({ t: 'vote', at: 3 });
    expect(decide({ phase: 'vote', vote: false })).toBeNull();
    const [tag] = decide({ phase: 'tag', options: [{ id: 'old', name: 'Old' }], done: false })!.act() as { id: string }[];
    expect(['', 'old']).toContain(tag.id);
  });
});
