import { describe, expect, it } from 'vitest';
import { roomQuestions } from './pack';

describe('Would You Rather question pool', () => {
  const packs = [
    { id: 'mine', name: 'Mine', blurb: '', prompts: ['fly or swim', 'nap or snack'] },
    { id: 'classic', name: 'Classic', blurb: '', prompts: ['swim or fly', 'tea or coffee'] },
  ];

  it("asks the picked packs' questions first, then the others', never one twice", () => {
    const pool = roomQuestions(packs, ['mine'], () => 0.99);
    expect(pool.slice(0, 2).sort()).toEqual(['fly or swim', 'nap or snack']);
    expect(pool.slice(2)).toEqual(['tea or coffee']); // "swim or fly" is "fly or swim"
  });

  it('shuffles with the random source it is given', () => {
    expect(roomQuestions(packs, ['mine', 'classic'], () => 0)).not.toEqual(roomQuestions(packs, ['mine', 'classic'], () => 0.99));
  });
});
