import { describe, expect, it } from 'vitest';
import { cardList as cards } from '../../lib/cards/notation';
import { newDeck } from '../../lib/cards/deck';
import { beats, classify } from './combos';
import { fault, lowestSingle, plays } from './moves';
import { power, sortBig2 } from './order';

const kind = (list: string) => classify(cards(list))?.kind ?? null;
const win = (a: string, b: string) => beats(classify(cards(a))!, classify(cards(b))!);

describe('Big 2 card order', () => {
  it('runs 3 lowest to 2 highest, and diamonds < clubs < hearts < spades within a rank', () => {
    expect(sortBig2(cards('2d As Kh 3s 3d 3c 3h'))).toEqual(cards('3d 3c 3h 3s Kh As 2d'));
    expect([power(cards('3d')[0]), power(cards('2s')[0])]).toEqual([0, 51]);
    expect(new Set(newDeck().map(power)).size).toBe(52);
  });
});

describe('Big 2 plays', () => {
  it('names singles, pairs, triples and the five-card hands, and nothing else', () => {
    expect([kind('7h'), kind('Ks Kd'), kind('9c 9h 9s')]).toEqual(['single', 'pair', 'triple']);
    expect([kind('3d 4c 5h 6s 7d'), kind('10s Jh Qd Kc As'), kind('2h 4h 9h Jh Kh')]).toEqual(['straight', 'straight', 'flush']);
    expect([kind('8s 8h 8d Kc Kd'), kind('5s 5h 5d 5c 3d'), kind('4c 5c 6c 7c 8c')]).toEqual(['full', 'four', 'sflush']);
    // A 2 is never in a straight; nor does one wrap round (house).
    expect([kind('Jd Qc Kh As 2s'), kind('As 2d 3c 4h 5s'), kind('2c 3d 4h 5s 6d')]).toEqual([null, null, null]);
    expect([kind('7h 8h'), kind('7h 7d 8c'), kind('7h 7d 7c 7s'), kind('3d 4c 5h 6s 8d'), kind('')]).toEqual([null, null, null, null, null]);
  });

  it('compares singles by card, pairs and triples by rank then the highest suit', () => {
    expect([win('2d', 'As'), win('7s', '7h'), win('7h', '7s')]).toEqual([true, true, false]);
    expect([win('Ks Kd', 'Kh Kc'), win('Kh Kc', 'Ks Kd'), win('3d 3c', 'Ks Kh')]).toEqual([true, false, false]);
    expect([win('2d 2c 2h', 'As Ah Ad'), win('Ks Kd', 'Kh Kc Kd')]).toEqual([true, false]);
  });

  it('ranks five-card hands by kind first, then within a kind as the rules say', () => {
    const ladder = ['10s Jh Qd Kc As', '2h 4h 9h Jh Kh', '3s 3h 3d 4c 4d', '3s 3h 3d 3c 4d', '3d 4d 5d 6d 7d'];
    for (let i = 1; i < ladder.length; i++) expect([win(ladder[i], ladder[i - 1]), win(ladder[i - 1], ladder[i])]).toEqual([true, false]);
    // Straights and straight flushes by the top card, its suit breaking a tie.
    expect([win('4d 5c 6h 7s 8s', '4s 5s 6s 7s 8h'), win('4c 5c 6c 7c 8c', '4d 5d 6d 7d 8d')]).toEqual([true, true]);
    // Flushes by the top card's rank, then down the cards, then the top card's suit.
    expect([win('3d 4d 5d 6d Kd', '9s 10s Js Qs 2s'), win('3h 5h 7h 9h Kh', '3s 4s 7s 9s Ks')]).toEqual([false, true]);
    expect([win('3h 5h 7h 9h Kh', '3c 5c 7c 9c Kc'), win('3c 5c 7c 9c Kc', '3h 5h 7h 9h Kh')]).toEqual([true, false]);
    // Full houses and four of a kind by the triple's or the four's rank.
    expect([win('4s 4h 4d 3c 3d', '3s 3h 3c Ad Ac'), win('5s 5h 5d 5c 3d', '4s 4h 4d 4c 2d')]).toEqual([true, true]);
  });
});

describe('Big 2 legal moves', () => {
  const table = (list: string) => classify(cards(list));
  it('a play is the same size as the table and beats it; a lead may be anything; the first play holds the lowest card', () => {
    const need = { table: table('9s 9h'), first: null };
    expect([fault(cards('Ks Kd'), need), fault(cards('5c 5d'), need), fault(cards('As'), need), fault(cards('4s 7d'), need), fault([], need)])
      .toEqual([null, 'too low', 'wrong size', 'not a hand', 'empty']);
    const first = { table: null, first: cards('3d')[0] };
    expect([fault(cards('3d 3s'), first), fault(cards('4c'), first), fault(cards('2s'), { table: null, first: null })]).toEqual([null, 'needs first', null]);
  });

  it('lists every play a hand may make, weakest first', () => {
    const hand = cards('3d 3c 4h 5s 6d 7c Ks');
    expect(plays(hand, { table: table('Kh'), first: null }).map((c) => c.cards)).toEqual([cards('Ks')]);
    expect(plays(hand, { table: table('3h 3s'), first: null })).toEqual([]);
    const leads = plays(hand, { table: null, first: cards('3d')[0] });
    expect(leads.every((c) => c.cards.includes(cards('3d')[0]))).toBe(true);
    expect(leads.map((c) => c.kind)).toEqual(['single', 'pair', 'straight']);
    expect(plays(hand, { table: table('3s 4s 5h 6h 7d'), first: null }).map((c) => c.cards)).toEqual([cards('3d 4h 5s 6d 7c'), cards('3c 4h 5s 6d 7c')]);
    expect(plays(hand, { table: table('3s 4s 5h 6h 7h'), first: null })).toEqual([]);
    expect([lowestSingle(hand, { table: table('9d'), first: null }), lowestSingle(hand, { table: table('3h 3s'), first: null })]).toEqual([cards('Ks')[0], null]);
  });
});
