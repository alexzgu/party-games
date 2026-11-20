import { describe, expect, it } from 'vitest';
import { cardKey, formatCard, giveaway, parseCards } from './cards';

describe('paste formats', () => {
  it('reads warm clues in their original order and reports malformed lines by line number', () => {
    const text = 'Umbrella: I hide in a closet; I spring open; I have ribs; I keep rain off your hair';
    const [card] = parseCards('warm', '\r\n' + text);
    expect(formatCard(card)).toBe(text);
    expect(() => parseCards('warm', text + '\r\n\r\nToast: Too short')).toThrow('Line 3');
  });

  it('reads and writes all four room card types', () => {
    const lines = [
      'side: Pots | Pans',
      'proof: Something green: no plants',
      'foley: A door slams [BANG] / Footsteps fade [TAP TAP]',
      'together: Something to do on a snow day',
    ];
    expect(parseCards('room', lines.join('\n')).map(formatCard)).toEqual(lines);
    expect(() => parseCards('room', 'side: A | B | C')).toThrow('Line 1');
    const [a, b] = parseCards('room', 'side: Pots | Pans\nside: pans | POTS!');
    expect(cardKey(a)).toBe(cardKey(b));
  });
});

describe('giveaways', () => {
  it('matches complete words after folding accents, case and punctuation', () => {
    expect(giveaway({ answer: 'Pokémon cards', clues: ['A Pokémon-themed binder.'] })).toBe('pokemon');
    expect(giveaway({ answer: 'Car', clues: ['I ride in a cart.'] })).toBeUndefined();
    expect(giveaway({ answer: 'The Sims', clues: ['I live in the suburbs.'] })).toBe('the');
  });

  it('rejects a pasted clue that names even one word of an answer', () => {
    expect(() => parseCards('warm', 'Tape measure: I retract; I bend; I measure; I fit in your pocket'))
      .toThrow('“measure”');
  });
});
