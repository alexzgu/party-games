import { describe, expect, it } from 'vitest';
import type { WordDeck } from './content';
import { afterImport, counted, findEntries, hitLine, pickedLine, tapped } from './packList';
import { deckEntry } from '../games/forehead/find';
import { packEntry as gibberishEntry } from '../games/gibberish/find';
import { boardEntry } from '../games/quiz/find';

// Moved here from the games' own find tests when the pack lists became one shared list.
const deck = (id: string, name: string, words: string[], added?: string): WordDeck => ({ id, name, emoji: '🃏', blurb: 'Big screen hits', words, added });
const decks = [deck('movies', 'Movies', ['Titanic', 'Shrek 2', 'Shrek']), deck('mine', 'Our Trip', ['Shrek Ride'], '2026-11-01'), deck('tv', 'TV', ['Friends'])].map(deckEntry);

describe('pack search', () => {
  it('matches by name or blurb, else names the first matching item', () => {
    expect(findEntries(decks, 'tri', 'suggested')).toEqual([{ entry: decks[1], hit: '' }]);
    expect(findEntries(decks, 'screen', 'suggested').map((h) => h.entry.id)).toEqual(['movies', 'mine', 'tv']);
    expect(findEntries(decks, 'shrek', 'suggested')).toEqual([{ entry: decks[0], hit: 'has “Shrek 2” and 1 more' }, { entry: decks[1], hit: 'has “Shrek Ride”' }]);
  });

  it('sorts newest first by date and A–Z by name', () => {
    expect(findEntries(decks, '', 'newest').map((h) => h.entry.id)).toEqual(['mine', 'movies', 'tv']);
    expect(findEntries(decks, '', 'az').map((h) => h.entry.id)).toEqual(['movies', 'mine', 'tv']);
  });

  const cards = [
    { phrase: 'Pup Corn', answer: 'Popcorn', hint: 'Food' },
    { phrase: 'Eye Scream', answer: 'Ice Cream', hint: 'Food' },
    { phrase: 'Sand A Claws', answer: 'Santa Claus', hint: 'Holiday' },
  ];
  const pack = (id: string, name: string, added?: string) => gibberishEntry({ id, name, blurb: 'Mixed bag', cards, ...(added ? { added } : {}) });

  it('names an item by its label even when it matched on other text', () => {
    expect(hitLine(pack('a', 'Snacks'), 'snack')).toBe('');
    expect(hitLine(pack('a', 'Snacks'), 'mixed')).toBe('');
    expect(hitLine(pack('a', 'Snacks'), 'ice cr')).toBe('has “Ice Cream”');
    expect(hitLine(pack('a', 'Snacks'), 'eye')).toBe('has “Ice Cream”');
    expect(hitLine(pack('a', 'Snacks'), 'food')).toBe('has “Popcorn” and 1 more');
    expect(hitLine(pack('a', 'Snacks'), 'zebra')).toBeNull();
  });

  it('sorts packs by age and name, keeping the suggested order on ties', () => {
    const packs = [pack('b', 'Zoo'), pack('a', 'Apes', '2026-11-01'), pack('c', 'Mid', '2026-11-10')];
    expect(findEntries(packs, '', 'suggested').map((x) => x.entry.id)).toEqual(['b', 'a', 'c']);
    expect(findEntries(packs, '', 'newest').map((x) => x.entry.id)).toEqual(['c', 'a', 'b']);
    expect(findEntries(packs, '', 'oldest').map((x) => x.entry.id)).toEqual(['b', 'a', 'c']);
    expect(findEntries(packs, '', 'az').map((x) => x.entry.id)).toEqual(['a', 'c', 'b']);
  });

  it('finds a board by a category before an answer, and counts its empty tiles', () => {
    const board = boardEntry({
      id: 'b', name: 'Mix', blurb: 'All sorts', categories: [
        { name: 'Food & Drink', clues: [{ clue: 'A green fruit for guacamole.', answer: 'Avocado' }, { clue: '', answer: '' }] },
        { name: 'Places', clues: [{ clue: 'City of light.', answer: 'Paris' }, { clue: 'Big apple.', answer: 'New York' }] },
      ],
    });
    expect(hitLine(board, 'food')).toBe('has “Food & Drink”');
    expect(hitLine(board, 'guac')).toBe('has “Avocado”');
    expect(board.sizeLabel).toBe('2 × 2');
    expect(board.details).toBe('Food & Drink · Places');
    expect(board.warn).toBe('1 empty');
  });
});

describe('picking packs', () => {
  it('ticks and unticks with several, and picks one when single', () => {
    expect(tapped(['a'], 'b', false)).toEqual(['a', 'b']);
    expect(tapped(['a', 'b'], 'a', false)).toEqual(['b']);
    expect(tapped(['a'], 'b', true)).toEqual(['b']);
    expect(tapped(['a'], 'a', true)).toEqual(['a']);
  });

  it('plays imported packs on their own, or adds them when asked to keep the picks', () => {
    expect(afterImport(['a'], ['x', 'y'], false)).toEqual(['x', 'y']);
    expect(afterImport(['a'], ['x', 'y'], true)).toEqual(['x']);
    expect(afterImport(['a', 'x'], ['x', 'y'], false, true)).toEqual(['y', 'a', 'x']);
    expect(afterImport(['a'], [], false)).toEqual(['a']);
  });

  it('counts every picked pack in the header, shown or not', () => {
    expect(pickedLine(decks, ['movies', 'tv'], 'words', false)).toBe('2 picked · 4 words');
    expect(pickedLine(decks, ['tv'], 'words', false)).toBe('1 picked · 1 word');
    expect(pickedLine(decks, [], 'words', false)).toBe('pick one or more');
    expect(pickedLine(decks, ['movies'], 'clues', true)).toBe('3 clues');
    expect(pickedLine(decks, [], 'clues', true)).toBe('pick one');
    expect(counted(1, 'prompts')).toBe('1 prompt');
  });
});
