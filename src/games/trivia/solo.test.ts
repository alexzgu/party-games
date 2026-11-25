import { describe, expect, it } from 'vitest';
import { CATEGORY_MS } from './state';
import { current, shown, SOLO_COUNT, soloNext, soloPick, soloStart, soloTick, type Solo } from './solo';
import { triviaKey } from './rules';

const lines = Array.from({ length: 14 }, (_, i) => `Science | What is fact number ${i}? | Right ${i} | Wrong ${i}a | Wrong ${i}b | Wrong ${i}c`);

describe('Smarty Pants solo', () => {
  it('plays ten questions with the room scoring, then ends with the score', () => {
    const run = soloStart(lines, [], 20, 0)!;
    let s: Solo = run.solo;
    expect([s.phase, s.questions.length, run.asked.length]).toEqual(['category', SOLO_COUNT, 0]);
    let t = CATEGORY_MS;
    s = soloTick(s, t);
    expect(s.phase).toBe('answer');
    expect(soloPick(s, current(s).right, t + 20_000)).toBe(s); // no time left: no tap
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
    const keys = (s: Solo) => s.questions.map((q) => triviaKey(`x | ${q.question}`));
    const first = soloStart(lines, [], 20, 0)!;
    let s = first.solo;
    let asked = shown(first.asked, s);
    for (let n = 2; n <= SOLO_COUNT; n++) asked = shown(asked, s = soloNext(soloPick(soloNext(s, 0), 0, 0), 0)); // question n on screen
    expect(asked).toEqual(keys(first.solo));
    const second = soloStart(lines, asked, 20, 0)!;
    expect(keys(second.solo).slice(0, 4).every((k) => !asked.includes(k))).toBe(true);
    expect(soloStart([], [], 20, 0)).toBeNull();
  });

  it('remembers only the questions a run showed, so quitting early skips just those', () => {
    const first = soloStart(lines, [], 20, 0)!;
    const asked = shown(first.asked, first.solo); // quit during question 1
    expect(asked).toEqual([triviaKey(`x | ${current(first.solo).question}`)]);
    const second = soloStart(lines, asked, 20, 0)!;
    expect(second.solo.questions.map((q) => q.question)).not.toContain(current(first.solo).question);
    expect(second.solo.questions).toHaveLength(SOLO_COUNT);
  });
});
