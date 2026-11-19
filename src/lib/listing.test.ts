import { describe, expect, it } from 'vitest';
import { fold, matches, sorted } from './listing';

describe('search', () => {
  it('ignores case, accents and punctuation, and matches word starts', () => {
    expect(fold('Pokémon!  Go')).toBe('pokemon go');
    expect(matches('The Lion King', 'lio ki')).toBe(true);
    expect(matches('The Lion King', 'ion')).toBe(false);
    expect(matches('Anything', '  ')).toBe(true);
  });
});

describe('sort', () => {
  const items = [{ n: 'b', t: 2 }, { n: 'A', t: 1 }, { n: 'c', t: 2 }];
  const run = (s: Parameters<typeof sorted>[1]) => sorted(items, s, (x) => x.n, (x) => x.t).map((x) => x.n);
  it('keeps suggested order, and ties keep it too', () => {
    expect(run('suggested')).toEqual(['b', 'A', 'c']);
    expect(run('newest')).toEqual(['b', 'c', 'A']);
    expect(run('oldest')).toEqual(['A', 'b', 'c']);
    expect(run('az')).toEqual(['A', 'b', 'c']);
  });
});
