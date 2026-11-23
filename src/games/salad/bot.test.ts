import { describe, expect, it } from 'vitest';
import { seeded } from '../../lib/room/bots';
import { saladPacks } from '../../lib/content';
import { categoryOf, saladBrain } from './bot';
import { readToHost } from './protocol';
import type { PlayerView } from './view';

const base = {
  code: 'BCDF', phase: 'pick', round: 1, at: 0, you: 'b1', serial: 9, players: [{ pid: 'b1', name: '🤖 Ada', seat: 0, score: 0, roundPoints: 0, kicked: false }],
  presenter: undefined, deadline: null, left: 20000, span: 20000, paused: false, hostPaused: false, held: false, solved: 0, total: 0,
  progress: [], sentences: [], guesses: [], acknowledged: [], result: null, offers: [], reshuffled: false, selected: null, awayMs: 60000,
  secret: null, draft: null, ready: false,
} as unknown as PlayerView;
const decide = (v: Partial<PlayerView>) => saladBrain().decide({ view: { ...base, ...v } as PlayerView, me: 'b1', left: 20000, rand: seeded(5), mem: {} });

describe('Word Salad bot', () => {
  it('picks one of its secrets', () => {
    const offers = [{ answer: 'Taco', category: 'thing', level: 'easy' }, { answer: 'Paris', category: 'place', level: 'medium' }] as PlayerView['offers'];
    const [m] = decide({ offers })!.act() as { index: number }[];
    expect(readToHost(m)).toMatchObject({ t: 'pick', serial: 9, reshuffled: false });
    expect([0, 1]).toContain(m.index);
  });

  it('fills each blank with its first choice, then publishes', () => {
    const frame = { text: "It looks like ___ and it's ___.", slots: ['noun', 'adjective'] } as const;
    const draft = { frame, index: 0, redeals: 0, choices: [['a shell', 'a cup'], ['crunchy', 'cold']], values: [null, null] };
    const prepare = { phase: 'prepare' as const, draft: draft as unknown as PlayerView['draft'] };
    expect(decide(prepare)!.act()).toEqual([{ serial: 9, t: 'word', frame: 0, slot: 0, value: 'a shell' }]);
    const half = { ...prepare, draft: { ...draft, values: ['a shell', null] } as unknown as PlayerView['draft'] };
    expect(decide(half)!.act()).toEqual([{ serial: 9, t: 'word', frame: 0, slot: 1, value: 'crunchy' }]);
    const full = { ...prepare, draft: { ...draft, values: ['a shell', 'crunchy'] } as unknown as PlayerView['draft'] };
    expect(decide(full)!.act()).toEqual([{ serial: 9, t: 'publish', frame: 0 }]);
  });

  it('guesses answers of the category the opening clue shows', () => {
    expect(categoryOf("Picture a beach somewhere sunny.")).toBe('place');
    const view = { phase: 'present' as const, presenter: 'p1', sentences: ["Picture a beach somewhere sunny."] };
    const [m] = decide(view)!.act() as { text: string }[];
    expect(readToHost(m)).toMatchObject({ t: 'guess', serial: 9 });
    const places = saladPacks().flatMap((p) => p.secrets).filter((s) => s.category === 'place').map((s) => s.answer);
    expect(places).toContain(m.text);
  });
});
