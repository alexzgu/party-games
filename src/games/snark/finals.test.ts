import { describe, expect, it } from 'vitest';
import type { SnarkFinal, SnarkPack } from '../../lib/content';
import { finalProblem, finalsNote, readFinals, removeFinal, setFinal } from './finals';

const good: SnarkFinal = { prompt: 'Three things to never say on a boat', house: ['Iceberg', 'Oops', 'Swim?'] };
const pack: SnarkPack = { id: 's', name: 'S', blurb: '', prompts: ['A bad name for a boat'], finals: [good] };

describe('finals', () => {
  it('are read as an import keeps them, with why the others are dropped', () => {
    const { finals, dropped } = readFinals([
      { ...good, prompt: ' Three  things to never say on a boat ' }, { ...good, prompt: good.prompt.toUpperCase() }, { ...good, prompt: 'Three' },
      { prompt: 'Three more things', house: ['a', 'b'] }, { prompt: 'Three long things', house: ['a', 'b', 'c'.repeat(41)] }, null,
    ]);
    expect(finals).toEqual([good]);
    expect(dropped.map((d) => d.why)).toEqual(['repeated', 'too short', 'needs 3 house lines', 'a house line is over 40 characters', 'no prompt']);
    expect(finalsNote(dropped)).toBe('Fix these finals first: “THREE THINGS TO NEVER SAY ON A BOAT” (repeated), “Three” (too short) and 3 more.');
  });

  it('are edited, added and removed within the limits', () => {
    expect(finalProblem(pack, 0, good)).toBe('');
    expect(finalProblem(pack, 'new', good)).toMatch(/already/);
    expect(finalProblem(pack, 'new', { ...good, prompt: 'a bad name for a boat' })).toMatch(/already/);
    expect(finalProblem(pack, 0, { ...good, prompt: 'Two words' })).toMatch(/3 to 14/);
    expect(finalProblem(pack, 0, { ...good, house: ['Iceberg', '', 'Swim?'] })).toBe('House line 2 needs 1 to 40 characters.');
    const two = setFinal(pack, 'new', { ...good, prompt: 'Three bad pets to get' });
    expect(two.finals?.map((f) => f.prompt)).toEqual(['Three bad pets to get', good.prompt]);
    expect(setFinal(two, 1, { ...good, house: ['a', 'b', 'c'] }).finals?.[1].house).toEqual(['a', 'b', 'c']);
    expect(removeFinal(two, 0)).toEqual(pack);
    expect('finals' in removeFinal(pack, 0)).toBe(false);
  });
});
