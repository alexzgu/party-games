import { describe, expect, it } from 'vitest';
import { findWords } from './find';

describe('word search', () => {
  it('filters words; newest is the top of the list, oldest the bottom', () => {
    const words = ['Zebra', 'Apple', 'Mango'];
    expect(findWords(words, 'ap', 'suggested')).toEqual(['Apple']);
    expect(findWords(words, '', 'newest')).toEqual(words);
    expect(findWords(words, '', 'oldest')).toEqual(['Mango', 'Apple', 'Zebra']);
    expect(findWords(words, '', 'az')).toEqual(['Apple', 'Mango', 'Zebra']);
  });
});
