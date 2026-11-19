import { describe, expect, it, vi } from 'vitest';

// Two packs that share an answer, as built-in packs sometimes do.
const card = (phrase: string, answer: string) => ({ phrase, answer, hint: '' });
vi.mock('../../lib/content', () => ({
  gibberishPacks: () => [
    { id: 'a', name: 'A', blurb: '', cards: [card('Eye Scream', 'Ice Cream'), card('Sand A Claws', 'Santa Claus'), card('Bee Yawn Say', 'Beyoncé')] },
    { id: 'b', name: 'B', blurb: '', cards: [card('I Scream', 'Ice cream'), card('Hair Eye Pot Her', 'Harry Potter')] },
  ],
}));

const { makeDealer } = await import('./deal');
const { answerKey } = await import('./parse');

describe('makeDealer', () => {
  it('deals every distinct answer once before repeating one, across packs', () => {
    for (let run = 0; run < 20; run++) {
      const dealer = makeDealer(['a', 'b']);
      const dealt: string[] = [];
      for (let i = 0; i < 4; i++) dealt.push(answerKey(dealer.next(dealt)!));
      expect(new Set(dealt).size).toBe(4);
    }
  });

  it('deals nothing when no chosen pack has cards', () => {
    expect(makeDealer(['missing']).next()).toBeUndefined();
  });
});
