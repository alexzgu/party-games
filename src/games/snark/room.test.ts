import { describe, expect, it } from 'vitest';
import type { SnarkPack } from '../../lib/content';
import { consent } from '../../lib/lend';
import { dealIn, lending, needs, pools, roomPrompts } from './room';

const pack = (id: string, prompts: number, finals = 0, custom = false): SnarkPack => ({
  id, name: id, blurb: '', custom, prompts: Array.from({ length: prompts }, (_, i) => `${id} prompt ${i}`),
  finals: Array.from({ length: finals }, (_, i) => ({ prompt: `${id} final ${i}`, house: ['One', 'Two', 'Three'] as [string, string, string] })),
});
const three = { rounds: 3, final: 'everyone' } as const, duels = { rounds: 3, final: 'duels' } as const;
const ids = (ps: readonly SnarkPack[]) => ps.map((p) => p.id);

describe("a Snark Tank room's prompts and finals", () => {
  const all = [pack('own', 100, 10, true), pack('mine', 6, 0, true), pack('classic', 10, 2), pack('after', 10, 3), pack('extra', 10)];

  it('counts a prompt per player per head-to-head round (round 2 with two late joiners) and the final', () => {
    expect([3, 5, 8].map((n) => needs(n, three, false))).toEqual([{ prompts: 9, finals: 0 }, { prompts: 13, finals: 0 }, { prompts: 17, finals: 0 }]);
    expect([3, 5, 8].map((n) => needs(n, duels, true))).toEqual([{ prompts: 8, finals: 3 }, { prompts: 12, finals: 4 }, { prompts: 16, finals: 4 }]);
    expect(needs(5, { rounds: 2, final: 'everyone' }, false)).toEqual({ prompts: 6, finals: 0 });
    expect(needs(5, duels, false)).toEqual({ prompts: 13, finals: 0 });
  });

  it("deals the picks' prompts alone when they are enough, and asks nothing", () => {
    const r = roomPrompts(all, { packIds: ['own'], ...duels }, 8);
    expect([r.lent, r.ask, r.problem, lending(r, false)]).toEqual([[], null, '', { prompts: [], finals: [] }]);
    expect(ids(pools(all, ['own'], lending(r, false)).prompts)).toEqual(['own']);
  });

  it('asks before other packs lend prompts, in pack order (built-ins first), and stops at enough', () => {
    const r = roomPrompts(all, { packIds: ['mine'], ...three }, 5);
    expect([r.ask?.noun, r.ask?.lenders, r.ask?.short]).toEqual(['prompts', ['classic'], 'Your packs have 6 prompts. 5 players need 13.']);
    expect(ids(pools(all, ['mine'], lending(r, false)).prompts)).toEqual(['mine']);
    expect(ids(pools(all, ['mine'], lending(r, true)).prompts)).toEqual(['mine', 'classic']);
    expect(roomPrompts(all, { packIds: ['mine'], ...three }, 8).ask?.lenders).toEqual(['classic', 'after']);
  });

  it('lends only the kind that is short: finals for duels when the picks have none', () => {
    const r = roomPrompts(all, { packIds: ['extra', 'after'], ...duels }, 5);
    expect([r.ask?.noun, r.ask?.lenders, r.ask?.short]).toEqual(['finals', ['classic'], 'Your packs have 3 finals. 5 players need 4.']);
    const none = roomPrompts([pack('mine', 50, 0, true), pack('classic', 10, 4)], { packIds: ['mine'], ...duels }, 5);
    expect([none.ask?.short, none.ask?.lenders]).toEqual(['Your packs have no finals.', ['classic']]);
    const lent = lending(none, true);
    expect(lent).toEqual({ prompts: [], finals: ['classic'] });
    const from = pools([pack('mine', 50, 0, true), pack('classic', 10, 4)], ['mine'], lent);
    expect([ids(from.prompts), ids(from.finals)]).toEqual([['mine'], ['mine', 'classic']]);
  });

  it('names both kinds when both are short', () => {
    const r = roomPrompts([pack('mine', 6, 0, true), pack('classic', 20, 5)], { packIds: ['mine'], ...duels }, 5);
    expect(r.ask?.short).toBe('Your packs have 6 prompts and no finals. 5 players need 12 prompts and 4 finals.');
    expect(lending(r, true)).toEqual({ prompts: ['classic'], finals: ['classic'] });
  });

  it('falls back to Classic alone when no pick exists, and keeps a yes only for the same question', () => {
    const r = roomPrompts(all, { packIds: ['gone'], ...three }, 5);
    expect([ids(r.packs), r.ask?.lenders]).toEqual([['classic'], ['after']]);
    expect(ids(pools(all, ['gone'], undefined).prompts)).toEqual(['classic']);
    const five = roomPrompts(all, { packIds: ['mine'], ...three }, 5).ask!, eight = roomPrompts(all, { packIds: ['mine'], ...three }, 8).ask!;
    expect(consent(five, '', five.key)).toBe(five.key);
    expect(consent(eight, five.key, '')).toBeNull();
  });

  it("deals the picks' prompts first and the lenders' only for the rest, none twice while any is left", () => {
    const inOrder = (items: readonly string[]) => { let i = 0; return { next: () => items[i++ % items.length] }; };
    const picks = ['a', 'b', 'c'], lent = ['x', 'y', 'z'], used = new Set<string>();
    const pool = [picks, lent];
    expect(dealIn(pool, 4, (t) => t, used, (i) => inOrder(pool[i]))).toEqual(['a', 'b', 'c', 'x']);
    expect(dealIn(pool, 3, (t) => t, used, (i) => inOrder(pool[i]))).toEqual(['y', 'z', 'a']);
    expect(dealIn([picks, []], 2, (t) => t, new Set(['a']), (i) => inOrder(pool[i]))).toEqual(['b', 'c']);
  });
});
