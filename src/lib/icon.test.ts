// One character as a person sees it: flags, joined emoji, skin tones and accents count as one.
import { describe, expect, it } from 'vitest';
import { isIcon, nextIcon, oneIcon } from './icon';

describe('oneIcon', () => {
  it('keeps one whole character, whatever it is made of', () => {
    expect(oneIcon('🇯🇵')).toBe('🇯🇵'); // a flag: two regional indicators
    expect(oneIcon('👩‍🚀')).toBe('👩‍🚀'); // joined with a zero-width joiner
    expect(oneIcon('👍🏽')).toBe('👍🏽'); // with a skin tone
    expect(oneIcon('a')).toBe('a');
    expect(oneIcon('é')).toBe('é'); // e with a combining accent
    expect(oneIcon('🃏')).toBe('🃏');
  });
  it('takes the first of a longer paste, and nothing from empty or spaces', () => {
    expect(oneIcon('Hello world')).toBe('H');
    expect(oneIcon('  🎉 party time 🎊')).toBe('🎉');
    expect(oneIcon('🇯🇵🇫🇷')).toBe('🇯🇵');
    expect(oneIcon('')).toBe('');
    expect(oneIcon('   ')).toBe('');
  });
  it('refuses a single character absurdly long', () => {
    expect(oneIcon('e' + '́'.repeat(40))).toBe('');
  });
});

describe('nextIcon', () => {
  it('lets what is typed after the icon replace it, and cuts a paste to its first character', () => {
    expect(nextIcon('🃏', '🃏🇯🇵')).toBe('🇯🇵');
    expect(nextIcon('🃏', '🃏 🎉 party')).toBe('🎉');
    expect(nextIcon('', '👩‍🚀 astronauts')).toBe('👩‍🚀');
    expect(nextIcon('🃏', 'Q🃏')).toBe('Q'); // typed before it: the first character
    expect(nextIcon('🃏', '')).toBe('');
    expect(nextIcon('🃏', '🃏 ')).toBe('🃏'); // only a space after it: it stays
  });
});

describe('isIcon', () => {
  it('is true only for exactly one character', () => {
    for (const ok of ['🇯🇵', '👩‍🚀', '👍🏽', 'Z', 'é']) expect(isIcon(ok)).toBe(true);
    for (const bad of ['', ' ', 'ab', '🎉🎉', ' 🎉', 'e' + '́'.repeat(40), 7, null]) expect(isIcon(bad)).toBe(false);
  });
});
