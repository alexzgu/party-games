import { describe, expect, it } from 'vitest';
import { parsePastedCards } from './parse';

describe('parsePastedCards', () => {
  it('reads Phrase | Answer | Category, defaulting the category to Anything', () => {
    const r = parsePastedCards('1. Eye Scream | Ice Cream | Food\n- Sand A Claws | Santa Claus\nnot a card at all');
    expect(r.items).toEqual([
      { phrase: 'Eye Scream', answer: 'Ice Cream', hint: 'Food' },
      { phrase: 'Sand A Claws', answer: 'Santa Claus', hint: 'Anything' },
    ]);
    expect(r.skipped).toEqual(["not in 'Phrase | Answer' form"]);
  });

  it('skips giveaway phrases with the reason', () => {
    const r = parsePastedCards('Thuh Lie On King | The Lion King | Movie\nHair Eye Pot Her | Harry Potter | Character');
    expect(r.items.map((c) => c.answer)).toEqual(['Harry Potter']);
    expect(r.skipped).toEqual(['phrase gives the answer away']);
  });

  it('reads markdown tables, ignoring the header, rule and row numbers', () => {
    const r = parsePastedCards('| # | Phrase | Answer | Category |\n|---|---|---|---|\n| 1 | Moan A Lease Ah | Mona Lisa | Art |');
    expect(r.items).toEqual([{ phrase: 'Moan A Lease Ah', answer: 'Mona Lisa', hint: 'Art' }]);
    expect(r.skipped).toEqual([]);
  });

  it('dedupes by answer against the pack being added to and within the paste', () => {
    const existing = [{ phrase: 'x', answer: 'Mona Lisa', hint: '' }];
    const r = parsePastedCards('Moan A Lease Ah | Mona Lisa\nBee Yawn Say | Beyoncé | Singer\nBee Yon Say | Beyonce | Singer', existing);
    expect(r.items.map((c) => c.answer)).toEqual(['Beyoncé']);
    expect(r.skipped).toEqual(['already in the pack', 'repeated']);
  });
});
