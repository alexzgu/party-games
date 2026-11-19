import { describe, expect, it } from 'vitest';
import { drawCard, pickWeighted } from './deck';
import { cardId } from './state';
import { spectrumPacks } from '../../lib/content';

describe('pickWeighted', () => {
  it('never picks an empty pack', () => {
    for (const r of [0, 0.3, 0.6, 0.999]) expect(pickWeighted([0, 5, 0], r)).toBe(1);
    expect(pickWeighted([1, 3], 0.2)).toBe(0);
    expect(pickWeighted([1, 3], 0.3)).toBe(1);
  });
});

describe('drawCard', () => {
  it('never deals a card already played this game', () => {
    const cards = spectrumPacks().find((p) => p.id === 'classic')!.cards;
    const keep = cards[17];
    const played = cards.filter((c) => c !== keep).map(cardId);
    expect(drawCard(['classic'], played)).toEqual(keep);
  });
});
