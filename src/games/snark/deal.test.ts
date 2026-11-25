import { describe, expect, it } from 'vitest';
import type { SnarkPack } from '../../lib/content';
import * as L from './logic';
import { drawFinals, drawPrompts } from './deal';

const pack = (id: string, prompts: string[]): SnarkPack => ({ id, name: id, blurb: '', custom: true, prompts });
const emptied = { picks: [pack('mine', [])], prompts: [pack('mine', [])], finals: [pack('mine', [])] };

describe('Snark Tank dealing when nothing is left', () => {
  it("brings the game's own prompts round again, and a plain line only when it has none", () => {
    expect(drawPrompts(emptied, 3, ['Old one', 'Old two'])).toEqual(['Old one', 'Old two', 'Old one']);
    expect(drawPrompts(emptied, 2, [])).toEqual([L.LAST_PROMPT, L.LAST_PROMPT]);
    expect(drawFinals(emptied, 2, [])).toEqual([]);
  });

  it('starts a round, or a final for everyone or of duels, without throwing when the deal comes back empty', () => {
    let g = L.newGame('BCDF', { rounds: 2, answerSecs: 75, voteSecs: 15, packIds: ['mine'], final: 'duels' });
    for (const pid of ['p0', 'p1', 'p2']) g = L.join(g, pid, `Name ${pid}`, new Set()).game;
    const none: L.Draw = () => [];
    g = L.startRound(g, none, 0);
    expect(g.items.map((x) => x.prompt)).toEqual([L.LAST_PROMPT, L.LAST_PROMPT, L.LAST_PROMPT]);
    g = L.startRound({ ...g, phase: 'scores' }, none, 0);
    expect(g.items).toMatchObject([{ kind: 'final', prompt: L.LAST_PROMPT }]);
  });
});
