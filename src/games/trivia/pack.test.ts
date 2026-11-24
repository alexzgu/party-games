import { describe, expect, it } from 'vitest';
import { pickedPacks, roomQuestions } from './pack';

describe('Smarty Pants question pool', () => {
  const line = (cat: string, q: string) => `${cat} | ${q} | Right | Wrong a | Wrong b | Wrong c`;
  const packs = [
    { id: 'mine', name: 'Mine', blurb: '', questions: [line('Art', 'Who painted this one?'), line('Art', 'WHO painted this one')] },
    { id: 'classic', name: 'Classic', blurb: '', questions: [line('Science', 'What is water made of?')] },
  ];

  it('asks the picked packs, the same question once, and Classic alone when none of the picks exists', () => {
    expect(roomQuestions(packs, ['mine'])).toHaveLength(1);
    expect(pickedPacks(packs, ['gone']).map((p) => p.id)).toEqual(['classic']);
    expect(roomQuestions(packs, ['gone'])).toEqual([line('Science', 'What is water made of?')]);
  });
});
