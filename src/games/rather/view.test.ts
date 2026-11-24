import { describe, expect, it } from 'vitest';
import * as L from './logic';
import { view } from './view';

function voting() {
  let g = L.newGame('g', 'BCDF', L.DEFAULT_SETTINGS);
  for (const pid of ['a', 'b', 'c']) g = (L.join(g, pid, pid.toUpperCase(), new Set()) as { game: L.Game }).game;
  g = L.start(g, ['fly or swim'], 0);
  g = L.vote(g, 'a', g.at, 1, 0);
  return L.vote(g, 'b', g.at, 1, 1);
}

describe('Would You Rather views', () => {
  it("never carry another player's vote before the reveal: only its own, and who has voted", () => {
    const g = voting();
    const host = view(g, 1);
    const a = view(g, 1, 'a');
    const c = view(g, 1, 'c');
    expect([host.voted, a.voted]).toEqual([['a', 'b'], ['a', 'b']]);
    expect([host.mine, a.mine, view(g, 1, 'b').mine, c.mine]).toEqual([undefined, 0, 1, undefined]);
    for (const v of [host, a, c]) expect(v.tally).toBeUndefined();
    expect(JSON.stringify(a)).not.toMatch(/"b":1|"side"|votes/);
  });

  it('show everyone every vote at the reveal', () => {
    const g = L.step(voting(), 1);
    const want = { counts: [1, 1], voters: [['a'], ['b']], winner: null };
    expect([view(g, 1).tally, view(g, 1, 'c').tally]).toEqual([want, want]);
  });
});
