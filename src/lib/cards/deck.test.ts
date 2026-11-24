import { describe, expect, it } from 'vitest';
import { seeded } from '../room/bots';
import * as D from './deck';

describe('playing cards', () => {
  it('reads every rank and suit once from the 52 ids', () => {
    const deck = D.newDeck();
    expect(new Set(deck.map((c) => `${D.rankOf(c)}${D.suitOf(c)}`)).size).toBe(52);
    expect(deck.every((c) => D.cardOf(D.rankOf(c), D.suitOf(c)) === c)).toBe(true);
    expect([D.rankOf(0), D.suitOf(0), D.rankOf(51), D.suitOf(51)]).toEqual([1, 'spades', 13, 'clubs']);
    expect([D.isCard(51), D.isCard(52), D.isCard(-1), D.isCard(1.5), D.isRank(13), D.isRank(0)]).toEqual([true, false, false, false, true, false]);
    expect(deck.filter(D.isRed).map(D.suitOf).every((s) => s === 'hearts' || s === 'diamonds')).toBe(true);
  });

  it('shuffles with the random numbers it is given', () => {
    const a = D.shuffledDeck(seeded(1));
    expect(a).toEqual(D.shuffledDeck(seeded(1)));
    expect(a).not.toEqual(D.newDeck());
    expect([...a].sort((x, y) => x - y)).toEqual(D.newDeck());
  });

  it('deals one at a time around the table and keeps the rest', () => {
    const { hands, rest } = D.deal(D.newDeck(), 3, 2);
    expect(hands).toEqual([[0, 3], [1, 4], [2, 5]]);
    expect(rest).toEqual(D.newDeck().slice(6));
    expect(D.deal([1, 2, 3], 2, 5)).toEqual({ hands: [[1, 3], [2]], rest: [] });
  });

  it('sorts a hand by rank, then suit', () => {
    const seven = (s: D.Suit) => D.cardOf(7, s);
    expect(D.sortHand([D.cardOf(13, 'spades'), seven('clubs'), D.cardOf(1, 'hearts'), seven('spades')]))
      .toEqual([D.cardOf(1, 'hearts'), seven('spades'), seven('clubs'), D.cardOf(13, 'spades')]);
  });

  it('names cards and ranks', () => {
    expect([D.cardName(D.cardOf(7, 'hearts')), D.cardName(D.cardOf(1, 'spades')), D.cardName(D.cardOf(12, 'clubs'))])
      .toEqual(['7 of hearts', 'ace of spades', 'queen of clubs']);
    expect([D.rankPlural(7), D.rankPlural(6), D.rankWord(1), D.rankLabel(10), D.rankLabel(11)]).toEqual(['sevens', 'sixes', 'ace', '10', 'J']);
  });
});
