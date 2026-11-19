import { describe, expect, it } from 'vitest';
import { findCards, findPacks, packHit } from './find';

const cards = [
  { phrase: 'Pup Corn', answer: 'Popcorn', hint: 'Food' },
  { phrase: 'Eye Scream', answer: 'Ice Cream', hint: 'Food' },
  { phrase: 'Sand A Claws', answer: 'Santa Claus', hint: 'Holiday' },
];
const pack = (id: string, name: string, added?: string) => ({ id, name, blurb: 'Mixed bag', cards, ...(added ? { added } : {}) });

describe('finding packs and cards', () => {
  it('matches a pack by name or blurb without a hit line, by a card with one', () => {
    expect(packHit(pack('a', 'Snacks'), 'snack')).toEqual({ match: true, hit: '' });
    expect(packHit(pack('a', 'Snacks'), 'mixed')).toEqual({ match: true, hit: '' });
    expect(packHit(pack('a', 'Snacks'), 'ice cr')).toEqual({ match: true, hit: 'has “Ice Cream”' });
    expect(packHit(pack('a', 'Snacks'), 'eye')).toEqual({ match: true, hit: 'has “Ice Cream”' });
    expect(packHit(pack('a', 'Snacks'), 'food')).toEqual({ match: true, hit: 'has “Popcorn” and 1 more' });
    expect(packHit(pack('a', 'Snacks'), 'zebra').match).toBe(false);
  });

  it('sorts packs by age and name, keeping the suggested order on ties', () => {
    const packs = [pack('b', 'Zoo'), pack('a', 'Apes', '2026-11-01'), pack('c', 'Mid', '2026-11-10')];
    expect(findPacks(packs, '', 'suggested').map((x) => x.p.id)).toEqual(['b', 'a', 'c']);
    expect(findPacks(packs, '', 'newest').map((x) => x.p.id)).toEqual(['c', 'a', 'b']);
    expect(findPacks(packs, '', 'oldest').map((x) => x.p.id)).toEqual(['b', 'a', 'c']);
    expect(findPacks(packs, '', 'az').map((x) => x.p.id)).toEqual(['a', 'c', 'b']);
  });

  it('filters cards and keeps their pack index; newest is the top of the pack', () => {
    expect(findCards(cards, 'food', 'suggested').map((x) => x.i)).toEqual([0, 1]);
    expect(findCards(cards, '', 'newest').map((x) => x.i)).toEqual([0, 1, 2]);
    expect(findCards(cards, '', 'oldest').map((x) => x.i)).toEqual([2, 1, 0]);
    expect(findCards(cards, '', 'az').map((x) => x.c.answer)).toEqual(['Ice Cream', 'Popcorn', 'Santa Claus']);
  });
});
