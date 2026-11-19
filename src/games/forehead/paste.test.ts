import { describe, expect, it } from 'vitest';
import { parsePastedWords } from './words';

describe('parsePastedWords', () => {
  it('reads one item per line and splits commas, cleaning like generated words', () => {
    const r = parsePastedWords('1. Moon Landing\n- "taylor swift"\n\nPizza Rat, Karaoke Night, spider-man.\n• **Eiffel Tower**');
    expect(r.items).toEqual(['Moon Landing', 'Taylor Swift', 'Pizza Rat', 'Karaoke Night', 'Spider-man', 'Eiffel Tower']);
    expect(r.skipped).toEqual([]);
  });

  it('skips prose and over-long lines with a reason each', () => {
    const r = parsePastedWords('Here are 30 words for Heads Down:\nZebra Crossing\nA really very long item here\nLet me know if you want more, or a different theme!');
    expect(r.items).toEqual(['Zebra Crossing']);
    expect(r.skipped).toEqual(['not a word or phrase', 'too long for a card', 'not a word or phrase']);
  });

  it('reads markdown tables, ignoring the header, rule and row numbers', () => {
    const r = parsePastedWords('| # | Word |\n|---|---|\n| 1 | Hot Dog |\n| 2 | Netflix and Chill |');
    expect(r.items).toEqual(['Hot Dog', 'Netflix and Chill']);
    expect(r.skipped).toEqual([]);
  });

  it('dedupes against the deck being added to and within the paste', () => {
    const r = parsePastedWords('Pizza Rat\npizza rat\nHot Dog\nHOT DOG!', ['Pizza Rat']);
    expect(r.items).toEqual(['Hot Dog']);
    expect(r.skipped).toEqual(['already in the deck', 'already in the deck', 'repeated']);
  });
});
