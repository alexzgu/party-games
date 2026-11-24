import { describe, expect, it } from 'vitest';
import { CATEGORY_MS } from './state';
import { current, SOLO_COUNT, soloNext, soloPick, soloStart, soloTick, type Solo } from './solo';
import { triviaKey } from './rules';

const lines = Array.from({ length: 14 }, (_, i) => `Science | What is fact number ${i}? | Right ${i} | Wrong ${i}a | Wrong ${i}b | Wrong ${i}c`);

describe('Smarty Pants solo', () => {
  it('plays ten questions with the room scoring, then ends with the score', () => {
    const run = soloStart(lines, [], 20, 0)!;
    let s: Solo = run.solo;
    expect([s.phase, s.questions.length, run.asked.length]).toEqual(['category', SOLO_COUNT, SOLO_COUNT]);
    let t = CATEGORY_MS;
    s = soloTick(s, t);
    expect(s.phase).toBe('answer');
    s = soloPick(s, current(s).right, t + 10_000); // right, half the time left
    expect([s.phase, s.gained, s.score, s.correct]).toEqual(['reveal', 750, 750, 1]);
    expect(soloPick(s, 0, t + 10_000)).toBe(s); // the first tap is final
    for (let n = 2; n <= SOLO_COUNT; n++) {
      s = soloNext(s, t);
      expect([s.phase, s.n, s.pick]).toEqual(['category', n, null]);
      s = soloNext(s, t); // the category skipped
      s = n % 2 ? soloPick(s, ((current(s).right + 1) % 4) as 0, t) : soloTick(s, t + 20_000); // wrong, or out of time
      expect([s.phase, s.gained]).toEqual(['reveal', 0]);
    }
    s = soloNext(s, t);
    expect([s.phase, s.score, s.correct]).toEqual(['over', 750, 1]);
  });

  it('asks questions this phone has not asked before, and none when the picks hold none', () => {
    const first = soloStart(lines, [], 20, 0)!;
    const second = soloStart(lines, first.asked, 20, 0)!;
    const keys = (s: Solo) => s.questions.map((q) => triviaKey(`x | ${q.question}`));
    expect(keys(second.solo).slice(0, 4).every((k) => !first.asked.includes(k))).toBe(true);
    expect(soloStart([], [], 20, 0)).toBeNull();
  });
});
