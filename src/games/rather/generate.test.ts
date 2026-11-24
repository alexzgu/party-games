import { describe, expect, it } from 'vitest';
import { readLine } from '../../lib/listWizard';
import { WIZARD } from './generate';

describe('Would You Rather wizard lines', () => {
  it('reads a question with or without its label, and drops lines that break the rules', () => {
    expect(readLine(WIZARD, 'Question: Would you rather be able to fly or be invisible?')).toEqual({ field: 'prompts', text: 'be able to fly or be invisible' });
    expect(readLine(WIZARD, '- only eat pizza or never eat pizza again')).toEqual({ field: 'prompts', text: 'only eat pizza or never eat pizza again' });
    expect(readLine(WIZARD, 'Question: be able to fly')).toBeNull(); // no "or"
    expect(readLine(WIZARD, 'Question: fly or swim or run')).toBeNull(); // three choices
  });
});
