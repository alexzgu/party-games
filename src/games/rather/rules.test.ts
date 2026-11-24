import { describe, expect, it } from 'vitest';
import { checked } from '../../lib/listSpec';
import { parseLists } from '../../lib/listPack';
import { RATHER_LISTS, ratherKey, ratherProblem, sides } from './rules';

const [spec] = RATHER_LISTS;

describe('Would You Rather questions', () => {
  it('splits a question into its two choices', () => {
    expect(sides('be able to fly or be invisible')).toEqual(['be able to fly', 'be invisible']);
  });

  it('tidies a pasted question to what a pack stores', () => {
    expect(checked(spec, 'Would you rather: Be able to fly OR be invisible?')).toBe('be able to fly or be invisible');
    expect(checked(spec, 'would you rather, eat pizza or tacos!!')).toBe('eat pizza or tacos');
    expect(checked(spec, 'Lick a subway pole or eat a gas station sushi roll')).toBe('lick a subway pole or eat a gas station sushi roll');
    expect(checked(spec, "Don't shower for a month or don't brush your teeth for a week")).toBe("don't shower for a month or don't brush your teeth for a week");
    expect(checked(spec, 'DJ every wedding or never dance again')).toBeNull(); // not one capital then lowercase: left alone, so it starts oddly
  });

  it('says why a question cannot be used', () => {
    expect(ratherProblem('be able to fly or be invisible')).toBe('');
    expect(ratherProblem('be able to fly')).toBe('needs one "or"');
    expect(ratherProblem('fly or swim or run')).toBe('needs one "or"');
    expect(ratherProblem('fly or ?')).toBe('too short');
    expect(ratherProblem(`fly or ${'very '.repeat(12)}far`)).toBe('too long');
    expect(ratherProblem(`fly or ${'x'.repeat(61)}`)).toBe('too long');
    expect(ratherProblem('fly or Fly!')).toBe('both choices are the same');
    expect(ratherProblem('Fly or swim')).toBe('starts oddly');
    expect(ratherProblem('would you rather fly or swim')).toBe('starts oddly');
    expect(ratherProblem('fly or swim?')).toBe('ends in punctuation');
  });

  it('counts the same choices in either order as one question', () => {
    expect(ratherKey('Fly, or be invisible')).toBe(ratherKey('be invisible or fly'));
    expect(ratherKey('fly or be invisible')).not.toBe(ratherKey('fly or be visible'));
  });

  it('keeps only usable questions from a pasted list', () => {
    const pasted = '1. Would you rather fly or be invisible?\n- only eat pizza\n- be invisible or fly\nFly or fly';
    expect(parseLists(pasted, RATHER_LISTS, () => 'prompts')).toEqual({
      items: [{ field: 'prompts', text: 'fly or be invisible' }],
      skipped: ['needs one "or"', 'repeated', 'both choices are the same'],
    });
  });
});
