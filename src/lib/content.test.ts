import { describe, expect, it } from 'vitest';
import { dedupe, gibberishPacks, slugify, spectrumPacks, wordDecks } from './content';

describe('built-in content', () => {
  it('loads every word deck with words', () => {
    const decks = wordDecks();
    expect(decks.length).toBeGreaterThanOrEqual(16);
    for (const d of decks) expect(d.words.length, d.id).toBeGreaterThan(50);
  });

  it('loads gibberish packs whose phrases never contain the answer words', () => {
    const packs = gibberishPacks();
    expect(packs.map((p) => p.id)).toEqual(['classic', 'pop', 'sayings', 'after-dark']);
    for (const p of packs)
      for (const c of p.cards) {
        const phrase = new Set(c.phrase.toLowerCase().split(/\s+/));
        const giveaway = c.answer.toLowerCase().split(/[\s'-]+/).filter((w) => w.length > 2 && phrase.has(w));
        expect(giveaway, `${p.id}: ${c.phrase}`).toEqual([]);
      }
  });

  it('loads spectrum packs with two-sided cards', () => {
    for (const p of spectrumPacks()) for (const c of p.cards) expect(c.left && c.right, p.id).toBeTruthy();
  });
});

describe('helpers', () => {
  it('dedupes ignoring case and spacing', () => {
    expect(dedupe(['Cat', ' cat', 'Big  Dog', 'big dog', ''])).toEqual(['Cat', 'Big Dog']);
  });
  it('slugifies names', () => {
    expect(slugify('2000s Cartoons!')).toBe('2000s-cartoons');
  });
});
