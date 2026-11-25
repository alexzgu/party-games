import { describe, expect, it } from 'vitest';
import * as L from './logic';
import { view } from './view';

const line = 'Science | What gas do plants take in from the air? | Carbon dioxide | Oxygen | Nitrogen | Helium';

/** A three-player game showing its first question's category (the question is on screen from `CATEGORY_MS`). */
function category() {
  let g = L.newGame('g', 'BCDF', L.DEFAULT_SETTINGS);
  for (const pid of ['a', 'b', 'c']) g = (L.join(g, pid, pid.toUpperCase(), new Set()) as { game: L.Game }).game;
  return L.start(g, [line, line.replace('plants', 'trees')], 0, () => 0.3);
}

/** The same game on the question: a answered right, b wrong, c not yet. */
function answering() {
  let g = L.step(category(), L.CATEGORY_MS);
  g = L.answer(g, 'a', g.at, 1, g.round!.q.right, 4000);
  return L.answer(g, 'b', g.at, 1, ((g.round!.q.right + 1) % 4) as L.Choice, 4000);
}

describe('Smarty Pants views', () => {
  it('never say which answer is right or carry another player\'s answer before the reveal', () => {
    const c = category();
    const g = answering();
    const right = g.round!.q.right;
    expect([c.phase, g.phase]).toEqual(['category', 'answer']);
    for (const v of [view(c, 1000), view(c, 1000, 'a'), view(c, 1000, 'c')]) {
      expect([v.phase, v.category, v.question, v.answers]).toEqual(['category', 'Science', undefined, undefined]);
    }
    for (const v of [view(c, 1000), view(c, 1000, 'a'), view(c, 1000, 'c'), view(g, 5000), view(g, 5000, 'a'), view(g, 5000, 'c')]) {
      expect(v.result).toBeUndefined();
      expect(JSON.stringify(v)).not.toMatch(/"right"|"choice"|"counts"|"gains"|"answers":\{|"left":\d+\}/);
    }
    expect([view(g, 5000).answered, view(g, 5000, 'c').answered]).toEqual([['a', 'b'], ['a', 'b']]);
    expect([view(g, 5000).mine, view(g, 5000, 'a').mine, view(g, 5000, 'c').mine]).toEqual([undefined, right, undefined]);
    expect(view(g, 5000, 'c').answers).toEqual(g.round!.q.answers);
  });

  it('show everyone the right answer, the counts and who scored at the reveal', () => {
    const g = L.step(answering(), 5000);
    const right = g.round!.q.right;
    for (const v of [view(g, 5000), view(g, 5000, 'c')]) {
      expect(v.result).toMatchObject({ right, gains: [{ pid: 'a', points: 975 }] });
      expect(v.result!.counts.reduce((x, y) => x + y)).toBe(2);
    }
  });
});
