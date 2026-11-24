import { describe, expect, it } from 'vitest';
import { readLine } from '../../lib/listWizard';
import { WIZARD } from './generate';

describe('Smarty Pants wizard lines', () => {
  it('reads a question with or without its label, and drops lines that break the rules', () => {
    const line = 'Geography | Which river flows through Cairo? | The Nile | The Amazon | The Danube | The Ganges';
    expect(readLine(WIZARD, `Question: ${line}`)).toEqual({ field: 'questions', text: line });
    expect(readLine(WIZARD, `- ${line}.`)).toEqual({ field: 'questions', text: line });
    expect(readLine(WIZARD, 'Question: Geography | Which river flows through Cairo? | The Nile')).toBeNull(); // three parts
    expect(readLine(WIZARD, 'Question: Geography | Which river flows through Cairo? | The Nile | The Nile | The Danube | The Ganges')).toBeNull(); // a repeated answer
  });
});
