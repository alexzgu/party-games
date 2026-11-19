import { describe, expect, it } from 'vitest';
import type { WordDeck } from '../../lib/content';
import { findDecks, findWords } from './find';

const deck = (id: string, name: string, words: string[], added?: string): WordDeck => ({ id, name, emoji: '🃏', blurb: 'Big screen hits', words, added });
const decks = [deck('movies', 'Movies', ['Titanic', 'Shrek 2', 'Shrek']), deck('mine', 'Our Trip', ['Shrek Ride'], '2026-11-01'), deck('tv', 'TV', ['Friends'])];

describe('deck search', () => {
  it('matches by name or blurb, else names the first matching word', () => {
    expect(findDecks(decks, 'tri', 'suggested')).toEqual([{ deck: decks[1] }]);
    expect(findDecks(decks, 'screen', 'suggested').map((h) => h.deck.id)).toEqual(['movies', 'mine', 'tv']);
    expect(findDecks(decks, 'shrek', 'suggested')).toEqual([{ deck: decks[0], via: 'Shrek 2' }, { deck: decks[1], via: 'Shrek Ride' }]);
  });

  it('sorts newest first by date and A–Z by name', () => {
    expect(findDecks(decks, '', 'newest').map((h) => h.deck.id)).toEqual(['mine', 'movies', 'tv']);
    expect(findDecks(decks, '', 'az').map((h) => h.deck.id)).toEqual(['movies', 'mine', 'tv']);
  });
});

describe('word search', () => {
  it('filters words; newest is the top of the list, oldest the bottom', () => {
    const words = ['Zebra', 'Apple', 'Mango'];
    expect(findWords(words, 'ap', 'suggested')).toEqual(['Apple']);
    expect(findWords(words, '', 'newest')).toEqual(words);
    expect(findWords(words, '', 'oldest')).toEqual(['Mango', 'Apple', 'Zebra']);
    expect(findWords(words, '', 'az')).toEqual(['Apple', 'Mango', 'Zebra']);
  });
});
