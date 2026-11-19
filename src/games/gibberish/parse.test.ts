import { describe, expect, it } from 'vitest';
import { givesAway, parseLine } from './parse';

describe('parseLine', () => {
  it('reads a plain line', () => {
    expect(parseLine('Eye Scream | Ice Cream | Food')).toEqual({ phrase: 'Eye Scream', answer: 'Ice Cream', hint: 'Food' });
  });

  it('tolerates numbering, quotes, markdown tables and labels', () => {
    const want = { phrase: 'Hair Eye Pot Her', answer: 'Harry Potter', hint: 'Character' };
    expect(parseLine('3. "Hair Eye Pot Her" | Harry Potter | Character')).toEqual(want);
    expect(parseLine('| Hair Eye Pot Her | Harry Potter | Character |')).toEqual(want);
    expect(parseLine('Phrase: Hair Eye Pot Her | Answer: Harry Potter | Category: Character')).toEqual(want);
    expect(parseLine('- **Hair Eye Pot Her** | Harry Potter | Character')).toEqual(want);
  });

  it('falls back to the theme when the category is missing', () => {
    expect(parseLine('Sand A Claws | Santa Claus', 'Holidays')?.hint).toBe('Holidays');
  });

  it('drops headers, prose and table rules', () => {
    expect(parseLine('Phrase | Answer | Category')).toBeNull();
    expect(parseLine('|---|---|---|')).toBeNull();
    expect(parseLine('Here are 20 cards for you:')).toBeNull();
  });

  it('drops phrases that contain the answer', () => {
    expect(parseLine('Thuh Lie On King | The Lion King | Movie')).toBeNull();
    expect(givesAway('Eye Scream', 'Ice Cream')).toBe(false);
    expect(givesAway('Lure Dove The Rings', 'Lord of the Rings')).toBe(true);
    expect(givesAway('Lure Dove The Wrings', 'Lord of the Rings')).toBe(false); // "the" alone is no giveaway
  });
});
