import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, newGame, type Game } from './core';
import { latinSquare } from './square';
import * as T from './telephone';
import * as L from './logic';
import { view } from './view';

const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const order = ['a', 'b', 'c', 'd'];
const at = 1000;
const online = new Set(order);
const start = (pids = order) => T.startTelephone({
  ...newGame('room', 'BCDF', DEFAULT_SETTINGS), players: pids.map((pid) => ({ pid, name: pid.toUpperCase(), score: 0 })),
}, pids, latinSquare(pids.length, seeded(7)), ['Idea one', 'Idea two', 'Idea three'], at);
const everyone = (g: Game, text = (pid: string) => `Line by ${pid}`) => order.reduce((x, pid) =>
  T.task(x, pid)!.kind === 'draw' ? T.submitDrawing(x, pid, x.at, false) : T.submitLine(x, pid, x.at, text(pid)), g);

describe('Telephone chains', () => {
  it('builds a Latin square: one chain per player per step, never a chain twice, own chain first, shuffled', () => {
    for (const n of [3, 4, 7, 10]) {
      const sq = latinSquare(n, seeded(n));
      const all = Array.from({ length: n }, (_, i) => i);
      for (const row of sq) expect([...row].sort((x, y) => x - y)).toEqual(all);
      for (const p of all) expect(sq.map((row) => row[p]).sort((x, y) => x - y)).toEqual(all);
      expect(sq[0]).toEqual(all);
    }
    // Who hands to whom changes between steps: the passes are not all one fixed rotation.
    const sq = latinSquare(7, seeded(3));
    const handsTo = (s: number) => sq[s].map((chain) => sq[s + 1].indexOf(chain));
    expect(new Set([1, 2, 3, 4, 5].map((s) => handsTo(s).join())).size).toBeGreaterThan(1);
  });

  it('alternates write, draw and describe, hands on only the entry before, and ends in the album', () => {
    let g = start();
    expect(g.phase).toBe('write');
    g = everyone(g);
    expect(L.tick(g, at + 1, online).phase).toBe('draw');
    g = L.tick(g, at + 1, online);
    const t = T.task(g, 'a')!;
    expect(t.kind).toBe('draw');
    expect(t.handed).toMatchObject({ kind: 'text', text: `Line by ${g.tel!.order[g.tel!.square[0].indexOf(t.chain)]}` });
    expect(view(g, at, 'a').task).toEqual({ id: t.id, kind: 'draw', line: (t.handed as { text: string }).text });
    g = L.tick(everyone(g), at + 2, online);
    expect(g.phase).toBe('describe');
    expect(view(g, at, 'b').task?.art).toMatch(/^room\/1\//);
    g = L.tick(everyone(L.tick(everyone(g), at + 3, online)), at + 4, online);
    expect(g.phase).toBe('album');
    expect(g.tel!.chains.every((c) => c.every(Boolean))).toBe(true);
  });

  it('waits only for players online and in the room, and fills gaps at the buzzer', () => {
    let g = start();
    g = T.submitLine(g, 'a', g.at, 'Hello');
    expect(L.tick(g, at + 10, online)).toBe(g);
    expect(L.tick(g, at + 10, new Set(['a'])).phase).toBe('draw');
    g = T.submitLine(g, 'b', g.at, '   ');
    expect(g.tel!.chains[1][0]).toEqual({ kind: 'text', text: 'Idea one', by: 'b', filled: true });
    g = L.tick(g, g.deadline! + 1000, online);
    expect(g.tel!.chains.map((c) => c[0])).toMatchObject([{ text: 'Hello' }, { filled: true }, { text: 'Idea two', filled: true }, { text: 'Idea three' }]);
    g = T.submitDrawing(g, 'a', g.at, true);
    g = L.tick(L.leave(g, 'c'), g.deadline! + 1000, online);
    expect(g.tel!.chains.flatMap((c) => c[1])).toEqual(expect.arrayContaining([{ kind: 'drawing', id: null, by: 'a' }, { kind: 'drawing', id: null, by: 'c' }]));
    expect(T.submitLine(g, 'c', g.at, 'Back?')).toBe(g);
  });

  it('waits out the reconnect grace before ending a step for the phones back so far', () => {
    const g = T.submitLine(start(), 'a', 1, 'Hello');
    const reopened = L.afterReload(g, at + 10);
    expect(L.tick(reopened, at + 5000, new Set(['a'])).phase).toBe('write');
    expect(L.tick(reopened, at + 10010, new Set(['a'])).phase).toBe('draw');
    expect(L.tick(L.regrace(reopened, at + 10010), at + 12000, new Set(['a'])).phase).toBe('write');
  });

  it('seats a player who left again when they rejoin the next game\'s lobby', () => {
    const g = L.leave(start(), 'd');
    // Play again keeps only active players but carries who left.
    const lobby = { ...newGame('next', 'BCDF', DEFAULT_SETTINGS), players: g.players.filter((p) => p.pid !== 'd'), kicked: g.kicked, left: g.left };
    const back = L.join(lobby, 'd', 'D', new Set()) as { game: Game };
    expect(back.game.players.map((p) => p.pid)).toEqual(['a', 'b', 'c', 'd']);
    expect(L.canStart(back.game)).toBe(true);
    expect(back.game.kicked).toEqual([]);
  });

  it('pages the album chain by chain, entry by entry, and stops at both ends', () => {
    let g = start(['a', 'b', 'c']);
    for (let i = 0; i < 3; i++) g = T.endStep(g, at);
    expect(T.turnPage(g, -1)).toBe(g);
    const pages: string[] = [];
    for (let i = 0; i < 9; i++) {
      pages.push(`${g.tel!.page.chain}.${g.tel!.page.entry}`);
      g = T.turnPage(g, 1);
    }
    expect(pages).toEqual(['0.0', '0.1', '0.2', '1.0', '1.1', '1.2', '2.0', '2.1', '2.2']);
    expect(T.albumEnd(g.tel!)).toBe(true);
    expect(T.turnPage(g, 1)).toBe(g);
    expect(view(T.turnPage(g, -1), at).album).toMatchObject({ chain: 2, entry: 1, starter: 'C' });
  });
});
