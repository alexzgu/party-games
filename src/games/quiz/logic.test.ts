import { describe, expect, it, vi } from 'vitest';
import type { QuizBoard } from '../../lib/content';
import * as q from './logic';

const board: QuizBoard = {
  id: 'test', name: 'Test Board', blurb: 'b',
  categories: ['A', 'B', 'C'].map((name) => ({ name, clues: [1, 2, 3].map((n) => ({ clue: `${name} clue ${n}`, answer: `${name}${n}` })) })),
};
const fresh = (penalty = false, double = false) => q.newGame({ teams: ['Reds', 'Blues', 'Greens'], board, double, penalty });
/** Opens a tile, shows the answer and gives it to `team` (-1 nobody), marking `wrong` first. */
const play = (g: q.Game, tile: number, team: number, wrong: number[] = []) => {
  let s = q.showAnswer(q.openTile(g, tile));
  for (const w of wrong) s = q.toggleWrong(s, w);
  return q.award(s, team);
};

describe('board values', () => {
  it('runs 100 up per row, or doubled', () => {
    expect(fresh().values).toEqual([100, 200, 300]);
    expect(fresh(false, true).values).toEqual([200, 400, 600]);
    expect(q.rowValues(5, false)).toEqual([100, 200, 300, 400, 500]);
  });
  it('numbers tiles by category then row', () => {
    const g = fresh();
    expect(q.tileAt(g, 1, 2)).toBe(5);
    expect(q.tileInfo(g, 5)).toMatchObject({ category: 'B', value: 300, answer: 'B3' });
  });
});

describe('playing tiles', () => {
  it('gives the tile value to the team that got it and dims the tile', () => {
    const g = play(fresh(), 1, 2);
    expect(q.scores(g)).toEqual([0, 0, 200]);
    expect(g.phase).toBe('board');
    expect(q.usedTiles(g).has(1)).toBe(true);
    expect(q.openTile(g, 1)).toBe(g);
  });
  it('scores nothing when nobody got it', () => {
    expect(q.scores(play(fresh(), 0, -1))).toEqual([0, 0, 0]);
  });
  it('putting a tile back leaves it playable and drops its wrong marks', () => {
    const g = q.closeTile(q.toggleWrong(q.openTile(fresh(true), 4), 0));
    expect(g.phase).toBe('board');
    expect(q.scores(g)).toEqual([0, 0, 0]);
    expect(q.usedTiles(g).size).toBe(0);
  });
  it('takes the value off wrong teams only with the penalty on, live while the tile is open', () => {
    const open = q.toggleWrong(q.openTile(fresh(true), 2), 0);
    expect(q.scores(open)).toEqual([-300, 0, 0]);
    expect(q.scores(q.toggleWrong(open, 0))).toEqual([0, 0, 0]);
    expect(q.scores(play(fresh(true), 2, 1, [0]))).toEqual([-300, 300, 0]);
    expect(q.toggleWrong(q.openTile(fresh(false), 2), 0).open!.wrong).toEqual([]);
  });
  it('a team marked wrong cannot win the tile', () => {
    const s = q.toggleWrong(q.showAnswer(q.openTile(fresh(true), 0)), 1);
    expect(q.award(s, 1)).toBe(s);
  });
  it('clears the board after the last tile', () => {
    let g = fresh();
    for (let t = 0; t < q.tileCount(g); t++) g = play(g, t, t % 3);
    expect(q.boardCleared(g)).toBe(true);
    expect(q.scores(g)).toEqual([300, 600, 900]);
  });
});

describe('undo and fixes', () => {
  it('reopens the last tile on its answer, wrong marks kept, so the right team can be tapped', () => {
    const g = q.undo(play(fresh(true), 3, 0, [2]));
    expect(g.phase).toBe('answer');
    expect(g.open).toEqual({ tile: 3, wrong: [2] });
    expect(q.scores(g)).toEqual([0, 0, -100]);
    expect(q.scores(q.award(g, 1))).toEqual([0, 100, -100]);
  });
  it('fixes a score by hand and undoes the fix', () => {
    const g = q.adjust(play(fresh(), 0, 0), 1, -200);
    expect(q.scores(g)).toEqual([100, -200, 0]);
    expect(q.undoLabel(g)).toBe('Blues −200');
    const u = q.undo(g);
    expect(q.scores(u)).toEqual([100, 0, 0]);
    expect(u.phase).toBe('board');
    expect(q.undoLabel(u)).toBe('A 100: Reds');
  });
  it('has nothing to undo on a new game', () => {
    const g = fresh();
    expect(q.undo(g)).toBe(g);
    expect(q.undoLabel(g)).toBe('');
  });
});

describe('ending and History', () => {
  it('records a cleared board as finished, winner first', () => {
    let g = fresh();
    for (let t = 0; t < q.tileCount(g); t++) g = play(g, t, t < 6 ? 1 : 0);
    const r = q.gameRecord(q.finish(g, false));
    expect(r).toMatchObject({ game: 'quiz', finished: true, packs: ['Test Board'] });
    expect(r.title).toBe('Blues won 1,200–600–0');
    expect(r.details).toHaveLength(9);
  });
  it('records an early end as not finished, and says who led', () => {
    const g = q.finish(play(play(fresh(), 0, 0), 1, 1), true);
    expect(q.gameRecord(g)).toMatchObject({ finished: false, title: 'Blues led 200–100–0' });
  });
  it('calls ties', () => {
    expect(q.gameRecord(q.finish(play(play(fresh(), 0, 0), 3, 1), true)).title).toBe('Reds and Blues tied 100–100–0');
  });
  it('starting over records a game in play only when something was scored, and never a finished one', () => {
    expect(q.endedRecord(play(fresh(), 0, -1))).toBeNull();
    expect(q.endedRecord(play(fresh(), 0, 2))).toMatchObject({ finished: false, title: 'Greens led 100–0–0' });
    expect(q.endedRecord(q.finish(play(fresh(), 0, 2), true))).toBeNull();
    expect(q.endedRecord(q.adjust(fresh(), 0, 100))).not.toBeNull();
  });
  it('a cleared board thrown away before its win screen is still a win', () => {
    let g = fresh();
    for (let t = 0; t < q.tileCount(g); t++) g = play(g, t, 0);
    expect(q.endedRecord(g)).toMatchObject({ finished: true, title: 'Reds won 1,800–0–0' });
  });
  it('knows when nothing has been scored', () => {
    expect(q.anyScored(play(fresh(), 0, -1))).toBe(false);
    expect(q.anyScored(play(fresh(true), 0, -1, [1]))).toBe(true);
    expect(q.leaders(fresh())).toEqual([]);
  });
});

describe('saving and resuming', () => {
  it('resumes every phase from storage exactly as saved', async () => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) });
    const { loadGame, saveGame } = await import('./store');
    const states = [
      play(fresh(true), 0, 1, [2]),
      q.toggleWrong(q.openTile(play(fresh(true), 0, 1), 4), 0),
      q.showAnswer(q.openTile(q.adjust(fresh(), 2, 300), 8)),
      q.finish(play(fresh(), 0, 1), true),
    ];
    for (const s of states) {
      saveGame(s);
      const back = loadGame()!;
      expect(back).toEqual(s);
      expect(q.scores(back)).toEqual(q.scores(s));
    }
    saveGame(null);
    expect(loadGame()).toBeNull();
    vi.unstubAllGlobals();
  });
  it('rejects damaged saves instead of breaking the app', () => {
    const g = play(fresh(), 0, 1);
    expect(q.validGame(JSON.parse(JSON.stringify(g)))).toEqual(g);
    expect(q.validGame(null)).toBeNull();
    expect(q.validGame({ ...g, v: 2 })).toBeNull();
    expect(q.validGame({ ...g, teams: ['Solo'] })).toBeNull();
    expect(q.validGame({ ...g, phase: 'clue', open: null })).toBeNull();
    expect(q.validGame({ ...g, log: [{ kind: 'tile', tile: 99, winner: 0, wrong: [] }] })).toBeNull();
    expect(q.validGame({ ...g, values: [100] })).toBeNull();
    expect(q.validGame({ ...g, board: { ...g.board, categories: [{ name: 'X', clues: [] }, ...g.board.categories] } })).toBeNull();
  });
  it('keeps good setup fields and replaces bad ones', async () => {
    const { validSetup, DEFAULT_SETUP } = await import('./store');
    expect(validSetup(null)).toEqual(DEFAULT_SETUP);
    expect(validSetup({ names: ['Us', 5], count: 9, boardId: 'x', double: true, penalty: 'yes' }))
      .toEqual({ names: ['Us', DEFAULT_SETUP.names[1], DEFAULT_SETUP.names[2], DEFAULT_SETUP.names[3]], count: 3, boardId: 'x', double: true, penalty: false });
  });
});
