import { describe, expect, it } from 'vitest';
import { answersNeeded, roomCards } from './pack';

const pack = (id: string, prompts: number, answers: number) => ({
  id, name: id, blurb: '', prompts: Array.from({ length: prompts }, (_, i) => `${id} prompt ${i} ___`), answers: Array.from({ length: answers }, (_, i) => `${id} answer ${i}`),
});

describe("a Bad Hand room's cards", () => {
  const classic = pack('classic', 100, 400), dark = pack('dark', 50, 200);

  it("deals the picks' cards alone when they are enough", () => {
    const r = roomCards([classic, dark], ['dark'], 6);
    expect([r.packs.map((p) => p.id), r.prompts.length, r.answers.length, r.added, r.problem]).toEqual([['dark'], 50, 200, [], '']);
  });

  it('adds answers from other packs, a pack at a time, when hands of ten would run short', () => {
    expect(answersNeeded(3)).toBe(70);
    expect(answersNeeded(10)).toBe(120);
    const mine = pack('mine', 3, 12);
    const r = roomCards([mine, classic, dark], ['mine'], 3);
    expect([r.prompts.length, r.answers.length, r.added]).toEqual([3, 412, ['classic']]);
  });

  it('adds prompts when the picks have none, and falls back to every pack when no pick exists', () => {
    const answersOnly = pack('answers', 0, 200);
    expect(roomCards([answersOnly, dark], ['answers'], 3)).toMatchObject({ added: ['dark'], problem: '' });
    expect(roomCards([classic, dark], ['gone'], 3).packs.map((p) => p.id)).toEqual(['classic', 'dark']);
  });

  it('says why when no pack has prompts or answers at all', () => {
    expect(roomCards([pack('a', 0, 5)], ['a'], 3).problem).toBe('No pack has prompt cards');
    expect(roomCards([pack('a', 5, 0)], ['a'], 3).problem).toBe('No pack has answer cards');
  });
});
