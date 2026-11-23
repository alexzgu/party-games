import { describe, expect, it } from 'vitest';
import { seeded } from '../../lib/room/bots';
import { handBrain } from './bot';
import { readToHost } from './protocol';
import type { View } from './view';

const base: View = { phase: 'answer', at: 5, left: 50000, total: 60000, paused: false, round: 1, target: 7, players: [], house: null, judge: 'j' };
const decide = (v: Partial<View>) => handBrain().decide({ view: { ...base, ...v }, me: 'b1', left: 50000, rand: seeded(3), mem: {} });

describe('Bad Hand bot', () => {
  const hand = [{ id: 1, text: 'A goose' }, { id: 2, text: '' }, { id: 3, text: 'Taxes' }];

  it('plays as many different cards as the prompt takes, typing on a blank one', () => {
    const [m] = decide({ answering: ['b1'], picks: 2, prompt: '___ and ___', hand })!.act() as { cards: number[]; texts: string[] }[];
    expect(m.cards).toHaveLength(2);
    expect(new Set(m.cards).size).toBe(2);
    expect(m.texts.every((t) => t.length > 0)).toBe(true);
    expect(readToHost(m)).not.toBeNull();
    expect(decide({ answering: ['b1'], picks: 1, hand, played: ['A goose'] })).toBeNull();
    expect(decide({ answering: ['b1'], picks: 1, hand, judge: 'b1' })).toBeNull();
  });

  it('as judge shows each answer in turn, then picks one', () => {
    const answers = [{ texts: ['a'] }, { texts: ['b'] }];
    const judge = { phase: 'judge' as const, judge: 'b1', answers };
    expect(decide({ ...judge, spotlight: null })!.act()).toEqual([{ t: 'spot', at: 5, i: 0 }]);
    const second = decide({ ...judge, spotlight: 0 })!;
    expect(second.wait).toBe(3000);
    expect(second.act()).toEqual([{ t: 'spot', at: 5, i: 1 }]);
    const [pick] = decide({ ...judge, spotlight: 1 })!.act() as { t: string; i: number }[];
    expect(pick.t).toBe('pick');
    expect([0, 1]).toContain(pick.i);
  });

  it('votes for someone else\'s answer', () => {
    const answers = [{ texts: ['a'] }, { texts: ['b'] }];
    expect(decide({ phase: 'vote', answers, canVote: true, hasVoted: false, mine: 0 })!.act()).toEqual([{ t: 'vote', at: 5, i: 1 }]);
    expect(decide({ phase: 'vote', answers, canVote: true, hasVoted: true, mine: 0 })).toBeNull();
  });
});
