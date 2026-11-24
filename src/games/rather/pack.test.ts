import { describe, expect, it } from 'vitest';
import { pickedPacks, roomQuestions } from './pack';
import { ratherKey } from './rules';

describe('Would You Rather question pool', () => {
  const packs = [
    { id: 'mine', name: 'Mine', blurb: '', prompts: ['fly or swim', 'nap or snack', 'swim or fly'] },
    { id: 'classic', name: 'Classic', blurb: '', prompts: ['tea or coffee'] },
    { id: 'after-dark', name: 'After Dark', blurb: '', prompts: ['wink or nod'] },
  ];

  it("asks only the picked packs' questions, never one twice (the same choices swapped are one)", () => {
    const keys = (qs: string[]) => qs.map(ratherKey).sort();
    expect(keys(roomQuestions(packs, ['mine']))).toEqual(keys(['fly or swim', 'nap or snack']));
    expect(keys(roomQuestions(packs, ['mine', 'after-dark']))).toEqual(keys(['fly or swim', 'nap or snack', 'wink or nod']));
  });

  it('falls back to Classic alone when none of the picks exists', () => {
    expect(pickedPacks(packs, ['gone']).map((p) => p.id)).toEqual(['classic']);
    expect(roomQuestions(packs, ['gone'])).toEqual(['tea or coffee']);
  });

  it('shuffles with the random source it is given', () => {
    expect(roomQuestions(packs, ['mine'], () => 0)).not.toEqual(roomQuestions(packs, ['mine'], () => 0.99));
  });
});
