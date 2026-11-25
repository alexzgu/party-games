import { describe, expect, it } from 'vitest';
import type { SketchPack } from '../../lib/content';
import { consent } from '../../lib/lend';
import { DEFAULT_SETTINGS, nextItems, newGame, type Game } from './core';
import * as G from './guess';
import * as L from './logic';
import { latinSquare } from './square';
import * as T from './telephone';
import { view } from './view';
import { dealItems, needed, roomItems } from './room';

const pack = (id: string, words: number, ideas = 0, custom = false): SketchPack => ({
  id, name: id, blurb: '', custom,
  words: Array.from({ length: words }, (_, i) => `${id} word ${i}`), ideas: Array.from({ length: ideas }, (_, i) => `${id} idea ${i}`),
});
const guess = { ...DEFAULT_SETTINGS, mode: 'guess' as const, rounds: 2 }, phone = { ...DEFAULT_SETTINGS, mode: 'telephone' as const };
const keep = <T,>(xs: readonly T[]) => [...xs];
const from = (items: readonly string[]) => [...new Set(items.map((t) => t.split(' ')[0]))];

describe("a Sketchy room's words and ideas", () => {
  const all = [pack('own', 200, 20, true), pack('mine', 12, 2, true), pack('classic', 20, 3), pack('after', 20, 3), pack('extra', 20, 3)];

  it('counts three words a turn (rounds after the first with two late joiners) or an idea per chain', () => {
    expect([3, 4, 8, 10].map((n) => needed(n, guess))).toEqual([24, 30, 54, 60]);
    expect(needed(4, { mode: 'guess', rounds: 1 })).toBe(12);
    expect([3, 10].map((n) => needed(n, phone))).toEqual([3, 10]);
  });

  it("deals the picks' items alone when they are enough, and asks nothing", () => {
    const r = roomItems(all, { ...guess, packs: ['own'] }, 10);
    expect([r.kind, r.lent, r.ask, r.problem, from(dealItems(r, false, keep))]).toEqual(['words', [], null, '', ['own']]);
  });

  it('asks before other packs lend, in pack order (built-ins first), stops at enough, and lends only with a yes', () => {
    const r = roomItems(all, { ...guess, packs: ['mine'] }, 4);
    expect([r.ask?.noun, r.ask?.lenders, r.ask?.short]).toEqual(['words', ['classic'], 'Your packs have 12 words. 4 players need 30.']);
    expect(from(dealItems(r, false, keep))).toEqual(['mine']);
    expect(from(dealItems(r, true, keep))).toEqual(['mine', 'classic']);
    const t = roomItems(all, { ...phone, packs: ['mine'] }, 7);
    expect([t.ask?.noun, t.ask?.lenders, t.ask?.short]).toEqual(['ideas', ['classic', 'after'], 'Your packs have 2 ideas. 7 players need 7.']);
  });

  it('falls back to Classic alone when no pick exists, and keeps a yes only for the same question', () => {
    expect(roomItems(all, { ...phone, packs: ['gone'] }, 3).packs.map((p) => p.id)).toEqual(['classic']);
    const four = roomItems(all, { ...guess, packs: ['mine'] }, 4).ask!, eight = roomItems(all, { ...guess, packs: ['mine'] }, 8).ask!;
    expect(eight.lenders).toEqual(['classic', 'after', 'extra']);
    expect(consent(four, '', four.key)).toBe(four.key);
    expect(consent(eight, four.key, '')).toBeNull();
  });
});

describe('a Sketchy game that runs out mid-game', () => {
  const players = (pids: string[]) => pids.map((pid) => ({ pid, name: pid.toUpperCase(), score: 0 }));

  it("brings the room's own items round again, least recently used first", () => {
    expect(nextItems(['a'], ['x', 'y', 'z'], 3)).toEqual({ items: ['a', 'x', 'y'], pool: ['z'], dealt: ['a', 'x', 'y'] });
    expect(nextItems(['a', 'b', 'c', 'd'], ['x'], 3)).toEqual({ items: ['a', 'b', 'c'], pool: ['d'], dealt: ['x', 'a', 'b', 'c'] });
  });

  it('Draw & guess offers words it already offered once the pool is spent, never others', () => {
    const words = ['Lamp', 'Cat', 'Moon', 'Sock'];
    let g: Game = G.startGuess({ ...newGame('room', 'BCDF', guess), players: players(['a', 'b', 'c']) }, words, 0);
    const offers: string[][] = [];
    for (let turn = 0; turn < 3; turn++) {
      offers.push(g.dg!.offer);
      g = L.skip(g, 0, new Set());
    }
    expect(offers).toEqual([['Lamp', 'Cat', 'Moon'], ['Sock', 'Lamp', 'Cat'], ['Moon', 'Sock', 'Lamp']]);
  });

  it("Telephone fills blank lines with the room's own ideas again, and Suggest offers only the room's", () => {
    const pids = ['a', 'b', 'c', 'd'];
    let g: Game = T.startTelephone({ ...newGame('room', 'BCDF', phone), players: players(pids) }, pids, latinSquare(4), ['One', 'Two'], 0);
    expect([view(g, 0, 'a').task?.ideas, view(g, 0, 'b').task?.ideas]).toEqual([['Two', 'One'], ['One', 'Two']]);
    g = T.endStep(g, 0);
    expect(g.tel!.chains.map((c) => (c[0] as { text: string }).text)).toEqual(['One', 'Two', 'One', 'Two']);
  });
});
