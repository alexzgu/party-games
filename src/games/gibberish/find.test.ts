import { describe, expect, it } from 'vitest';
import { findCards } from './find';

const cards = [
  { phrase: 'Pup Corn', answer: 'Popcorn', hint: 'Food' },
  { phrase: 'Eye Scream', answer: 'Ice Cream', hint: 'Food' },
  { phrase: 'Sand A Claws', answer: 'Santa Claus', hint: 'Holiday' },
];

describe('finding cards', () => {
  it('filters cards and keeps their pack index; newest is the top of the pack', () => {
    expect(findCards(cards, 'food', 'suggested').map((x) => x.i)).toEqual([0, 1]);
    expect(findCards(cards, '', 'newest').map((x) => x.i)).toEqual([0, 1, 2]);
    expect(findCards(cards, '', 'oldest').map((x) => x.i)).toEqual([2, 1, 0]);
    expect(findCards(cards, '', 'az').map((x) => x.c.answer)).toEqual(['Ice Cream', 'Popcorn', 'Santa Claus']);
  });
});
