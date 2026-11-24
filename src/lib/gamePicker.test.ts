import { describe, expect, it } from 'vitest';
import { matching, searchAtOnce } from './gamePicker';

const options = [
  { id: 'all', name: 'All games', emoji: '🎲' },
  { id: 'forehead', name: 'Heads Down.', emoji: '🤯' },
  { id: 'poke', name: 'Pokémon Quiz', emoji: '⚡' },
];
const ids = (q: string) => matching(options, q).map((o) => o.id);

describe('matching', () => {
  it('keeps every option for an empty search', () => {
    expect(ids('  ')).toEqual(['all', 'forehead', 'poke']);
  });
  it('matches anywhere in the name, ignoring case and accents', () => {
    expect(ids('DOWN')).toEqual(['forehead']);
    expect(ids('pokemon')).toEqual(['poke']);
    expect(ids('mon q')).toEqual(['poke']);
    expect(ids('zzz')).toEqual([]);
  });
});

describe('searchAtOnce', () => {
  it('focuses the search from the keyboard or a fine pointer, never by itself on a touch phone', () => {
    expect(searchAtOnce(true, true)).toBe(true);
    expect(searchAtOnce(false, false)).toBe(true);
    expect(searchAtOnce(false, true)).toBe(false);
  });
});
