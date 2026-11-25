import { describe, expect, it } from 'vitest';
import { drawCard, gamePacks, pickWeighted, roomDeck } from './deck';
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

describe("a Spectrum game's cards", () => {
  const pack = (id: string, cards: number, custom = false) => ({
    id, name: id, blurb: '', custom, cards: Array.from({ length: cards }, (_, i) => ({ left: `${id} left ${i}`, right: `${id} right ${i}` })),
  });
  const all = [pack('mine', 3, true), pack('empty', 0, true), pack('classic', 5), pack('after', 5)];

  it('deals from picks with cards alone and asks nothing', () => {
    const r = roomDeck(all, ['mine']);
    expect([r.lent, r.ask, r.problem, gamePacks(all, ['mine']).map((p) => p.id)]).toEqual([[], null, '', ['mine']]);
  });

  it('asks before Classic lends when the picks have no cards, and lends it only with a yes', () => {
    const r = roomDeck(all, ['empty']);
    expect([r.ask?.short, r.ask?.lenders, r.ask?.noun]).toEqual(['Your packs have no cards.', ['classic'], 'cards']);
    expect(gamePacks(all, ['empty']).map((p) => p.id)).toEqual(['empty']);
    expect(gamePacks(all, ['empty'], ['classic']).map((p) => p.id)).toEqual(['empty', 'classic']);
  });

  it('plays Classic alone when every pick has been deleted, never every pack', () => {
    expect([roomDeck(all, ['gone']).packs.map((p) => p.id), roomDeck(all, ['gone']).ask]).toEqual([['classic'], null]);
    expect(gamePacks(all, ['gone']).map((p) => p.id)).toEqual(['classic']);
  });

  it("deals a deleted pick's game from Classic alone, and from a lent pack only once it is lent", () => {
    const cardsOf = (id: string) => spectrumPacks().find((p) => p.id === id)!.cards.map(cardId);
    const other = spectrumPacks().find((p) => p.id !== 'classic' && p.cards.length)!.id;
    for (let i = 0; i < 20; i++) expect(cardsOf('classic')).toContain(cardId(drawCard(['gone'])!));
    for (let i = 0; i < 20; i++) expect([...cardsOf('classic'), ...cardsOf(other)]).toContain(cardId(drawCard(['gone'], [], [other])!));
  });
});
