import { describe, expect, it } from 'vitest';
import { consent } from '../../lib/lend';
import { dealTitles, roomTitles, titlesNeeded } from './pack';

const pack = (id: string, titles: number, custom = false) => ({
  id, name: id, blurb: '', custom, titles: Array.from({ length: titles }, (_, i) => `${id} title ${i}`),
});
const keep = <T,>(xs: T[]) => xs;
const from = (titles: readonly string[]) => [...new Set(titles.map((t) => t.split(' ')[0]))];

describe("a Doodle Brawl room's titles", () => {
  const all = [pack('own', 100, true), pack('mine', 10, true), pack('classic', 5), pack('after', 5), pack('extra', 5)];

  it('counts a title per bout in round 1, a title and a rematch title per bout in round 2, and two late joiners', () => {
    expect([3, 4, 5, 6, 7, 8].map(titlesNeeded)).toEqual([13, 16, 19, 22, 23, 24]);
  });

  it("deals the picks' titles alone when they are enough, and asks nothing", () => {
    const r = roomTitles(all, ['own'], 8);
    expect([r.lent, r.ask, r.problem, from(dealTitles(r, false, keep))]).toEqual([[], null, '', ['own']]);
  });

  it('asks before other packs lend, in pack order (built-ins first), and stops at enough', () => {
    const r = roomTitles(all, ['mine'], 4);
    expect([r.ask?.lenders, r.ask?.short]).toEqual([['classic', 'after'], 'Your packs have 10 titles. 4 players need 16.']);
    expect(from(dealTitles(r, false, keep))).toEqual(['mine']);
    expect(from(dealTitles(r, true, keep))).toEqual(['mine', 'classic', 'after']);
  });

  it('skips a pack that adds no new title, and falls back to Classic alone when no pick exists', () => {
    const copy = { ...pack('copy', 0), titles: pack('mine', 10).titles.map((t) => t.toUpperCase() + '!') };
    expect(roomTitles([pack('mine', 10, true), copy, pack('classic', 20)], ['mine'], 3).ask?.lenders).toEqual(['classic']);
    expect(roomTitles(all, ['gone'], 3).packs.map((p) => p.id)).toEqual(['classic']);
  });

  it('keeps a yes only for the same question', () => {
    const four = roomTitles(all, ['mine'], 4).ask!, eight = roomTitles(all, ['mine'], 8).ask!;
    expect(eight.lenders).toEqual(['classic', 'after', 'extra']);
    expect(consent(four, '', four.key)).toBe(four.key);
    expect(consent(eight, four.key, '')).toBeNull();
  });
});
