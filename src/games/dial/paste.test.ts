import { describe, expect, it } from 'vitest';
import { parsePastedPairs } from './generate';
import { skipNote } from '../../components/PasteList.svelte';

describe('parsePastedPairs', () => {
  it('reads Left | Right and the other separators, skipping the rest with a reason', () => {
    const r = parsePastedPairs('Here are some cards:\n1. Cold | Hot\n- Soft vs Hard\nTiny - Huge\nQuiet / Loud\nJust one end\nA | B | C');
    expect(r.items).toEqual([
      { left: 'Cold', right: 'Hot' }, { left: 'Soft', right: 'Hard' }, { left: 'Tiny', right: 'Huge' }, { left: 'Quiet', right: 'Loud' },
    ]);
    expect(r.skipped).toEqual(Array(3).fill("not in 'Left | Right' form"));
  });

  it('reads markdown tables with a header and a number column', () => {
    const r = parsePastedPairs('| # | Left | Right |\n|:-:|---|---|\n| 1 | Underrated | Overrated |\n| 2 | Cheap | Expensive |');
    expect(r.items).toEqual([{ left: 'Underrated', right: 'Overrated' }, { left: 'Cheap', right: 'Expensive' }]);
    expect(r.skipped).toEqual([]);
  });

  it('dedupes against the pack being added to and within the paste', () => {
    const r = parsePastedPairs('Cold | Hot\nbland | spicy\nBland | Spicy', [{ left: 'Cold', right: 'Hot' }]);
    expect(r.items).toEqual([{ left: 'Bland', right: 'Spicy' }]);
    expect(r.skipped).toEqual(['already in the pack', 'repeated']);
  });
});

describe('skipNote', () => {
  it('counts skipped lines by reason', () => {
    expect(skipNote([])).toBe('');
    expect(skipNote(['repeated'])).toBe('1 line skipped: repeated');
    expect(skipNote(Array(3).fill("not in 'Left | Right' form"))).toBe("3 lines skipped: not in 'Left | Right' form");
    expect(skipNote(['a', 'b', 'a'])).toBe('3 lines skipped: 2 a, 1 b');
  });
});
