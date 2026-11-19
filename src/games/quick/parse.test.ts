import { describe, expect, it } from 'vitest';
import { cleanPrompt, parsePasted, promptError } from './parse';

describe('reading typed and pasted prompts', () => {
  it('drops the lead-in, list markers, quotes and end punctuation', () => {
    expect(cleanPrompt('Name 3 things you’d find in a fridge.')).toBe('things you’d find in a fridge');
    expect(cleanPrompt('1. "Pizza toppings!"')).toBe('Pizza toppings');
    expect(cleanPrompt('- Things in a garage')).toBe('things in a garage');
    expect(cleanPrompt('Name three: Taylor Swift songs')).toBe('Taylor Swift songs');
    expect(cleanPrompt('| 4 | words that rhyme with cat |')).toBe('words that rhyme with cat');
  });

  it('says what is wrong with a prompt', () => {
    expect(promptError('', [])).toMatch(/Type/);
    expect(promptError('one two three four five six seven eight nine ten eleven', [])).toMatch(/10 words/);
    expect(promptError('pizza toppings', ['Pizza  Toppings'])).toMatch(/already/);
    expect(promptError('pizza toppings', [])).toBe('');
  });

  it('keeps each new prompt once and says why lines were skipped', () => {
    const { items, skipped } = parsePasted('pizza toppings\n\nkinds of soup\nPizza toppings\nbirds', ['birds']);
    expect(items).toEqual(['pizza toppings', 'kinds of soup']);
    expect(skipped).toEqual(['already in the pack', 'already in the pack']);
  });
});
