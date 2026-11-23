import { describe, expect, it } from 'vitest';
import { askLine, readLine } from '../../lib/listWizard';
import { ideasFor, WIZARD } from './generate';

describe('Sketchy wizard lines', () => {
  it('reads words and ideas by their label, tidied, and drops lines that break the rules', () => {
    expect(readLine(WIZARD, 'Word: lava lamp.')).toEqual({ field: 'words', text: 'Lava lamp' });
    expect(readLine(WIZARD, '- **Idea:** a cat filing its taxes!')).toEqual({ field: 'ideas', text: 'A cat filing its taxes' });
    expect(readLine(WIZARD, 'Word: R2-D2')).toBeNull(); // digits
    expect(readLine(WIZARD, 'Word: a very long thing to draw')).toBeNull(); // over 3 words
    expect(readLine(WIZARD, 'Idea: Cat')).toBeNull(); // under 3 words
    expect(readLine(WIZARD, 'Lava lamp')).toBeNull(); // no label
  });

  it('asks for about one idea per three words', () => {
    expect([15, 45, 120].map(ideasFor)).toEqual([5, 15, 40]);
    expect(askLine(WIZARD, WIZARD.split(45))).toBe('45 words and 15 ideas');
  });
});
