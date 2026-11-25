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

  it('treats lending words and lending ideas from the same packs as two questions', () => {
    const words = roomItems(all, { ...guess, packs: ['mine'] }, 4).ask!, ideas = roomItems(all, { ...phone, packs: ['mine'] }, 3).ask!;
    expect([words.lenders, ideas.lenders]).toEqual([['classic'], ['classic']]);
    expect(consent(ideas, words.key, '')).toBeNull();
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

  it('a game saved before it kept the words offered brings its last offer round again, and a turn with nothing to offer ends the game', () => {
    let g: Game = G.startGuess({ ...newGame('room', 'BCDF', guess), players: players(['a', 'b', 'c']) }, ['Lamp', 'Cat', 'Moon', 'Sock'], 0);
    const { dealt: _, ...old } = g.dg!;
    g = L.skip({ ...g, dg: old }, 0, new Set());
    expect([g.phase, g.dg!.offer]).toEqual(['pick', ['Sock', 'Lamp', 'Cat']]);
    const empty: Game = { ...g, dg: { ...g.dg!, pool: [], offer: [], dealt: undefined } };
    expect(L.skip(empty, 0, new Set()).phase).toBe('over');
    expect(G.advance(empty, 0, new Set()).phase).toBe('over');
  });

  it("Telephone fills blank lines with the room's own ideas again, and Suggest offers only the room's", () => {
    const pids = ['a', 'b', 'c', 'd'];
    let g: Game = T.startTelephone({ ...newGame('room', 'BCDF', phone), players: players(pids) }, pids, latinSquare(4), ['One', 'Two'], 0);
    expect([view(g, 0, 'a').task?.ideas, view(g, 0, 'b').task?.ideas]).toEqual([['Two', 'One'], ['One', 'Two']]);
    g = T.endStep(g, 0);
    expect(g.tel!.chains.map((c) => (c[0] as { text: string }).text)).toEqual(['One', 'Two', 'One', 'Two']);
  });

  const ideas = (n: number) => Array.from({ length: n }, (_, i) => `Idea ${i}`);
  const phoneGame = (seats: number, room: string[]) => {
    const pids = Array.from({ length: seats }, (_, i) => `p${i}`);
    return T.startTelephone({ ...newGame('room', 'BCDF', phone), players: players(pids) }, pids, latinSquare(seats), room, 0);
  };
  const offered = (g: Game) => g.tel!.order.map((pid) => view(g, 0, pid).task!.ideas!);
  /** Every tap, every seat is offered a different idea, and no seat is offered one twice. */
  const apart = (lists: string[][]) => lists[0].every((_, tap) => new Set(lists.map((l) => l[tap])).size === lists.length) && lists.every((l) => new Set(l).size === l.length);

  it('Suggest offers no two seats the same idea on the same tap while the room has an idea per seat', () => {
    for (const n of [5, 10]) {
      const lists = offered(phoneGame(5, ideas(n)));
      expect([lists.length, lists[0].length, apart(lists)]).toEqual([5, 5, true]);
    }
    expect(offered(phoneGame(5, ideas(10))).map((l) => l[0])).toEqual(['Idea 9', 'Idea 7', 'Idea 5', 'Idea 3', 'Idea 1']);
  });

  it('fills a blank line with an idea nobody is offered or wrote where there is one', () => {
    let g = phoneGame(3, ideas(20));
    const shown = new Set(offered(g).flat());
    g = T.submitLine(g, 'p0', g.at, offered(g)[1][0]);
    g = T.endStep(g, 0);
    const lines = g.tel!.chains.map((c) => (c[0] as { text: string; filled?: boolean }));
    expect(lines.filter((l) => l.filled).every((l) => !shown.has(l.text))).toBe(true);
    expect(new Set(lines.map((l) => l.text)).size).toBe(3);
    expect(g.tel!.ideas).not.toContain(offered(phoneGame(3, ideas(20)))[1][0]);
  });
});
