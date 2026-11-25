import { describe, expect, it } from 'vitest';
import { consent } from '../../lib/lend';
import { answersNeeded, deal, roomCards } from './pack';

const pack = (id: string, prompts: number, answers: number, custom = false) => ({
  id, name: id, blurb: '', custom, prompts: Array.from({ length: prompts }, (_, i) => `${id} prompt ${i} ___`), answers: Array.from({ length: answers }, (_, i) => `${id} answer ${i}`),
});
const from = (cards: readonly string[]) => [...new Set(cards.map((c) => c.split(' ')[0]))];

describe("a Bad Hand room's cards", () => {
  const classic = pack('classic', 100, 400), dark = pack('dark', 50, 200);

  it("deals the picks' cards alone when they are enough, and asks nothing", () => {
    const r = roomCards([classic, dark], ['dark'], 6);
    const d = deal(r, false);
    expect([r.packs.map((p) => p.id), d.prompts.length, d.answers.length, r.lent, r.ask, r.problem]).toEqual([['dark'], 50, 200, [], null, '']);
  });

  it('asks before other packs lend answers, a whole pack at a time, when hands of ten would run short', () => {
    expect(answersNeeded(3)).toBe(70);
    expect(answersNeeded(10)).toBe(120);
    const mine = pack('mine', 3, 12);
    const r = roomCards([mine, classic, dark], ['mine'], 3);
    expect([r.lent.map((p) => p.id), r.ask?.lenders, r.ask?.short]).toEqual([['classic'], ['classic'], 'Your packs have 12 answer cards. 3 players need 70.']);
    expect([deal(r, false).answers.length, deal(r, true).prompts.length, deal(r, true).answers.length]).toEqual([12, 3, 412]);
  });

  it("lends in pack order (built-ins first), stops at enough, and deals exactly the picks and the named packs after a yes", () => {
    const own = pack('own', 5, 500, true), mine = pack('mine', 3, 12, true);
    const small = [pack('classic', 10, 40), pack('after', 10, 40), pack('extra', 10, 40), pack('last', 10, 40)];
    const r = roomCards([own, mine, ...small], ['mine'], 10);
    expect([r.ask?.lenders, r.ask?.short]).toEqual([['classic', 'after', 'extra'], 'Your packs have 12 answer cards. 10 players need 120.']);
    expect(from(deal(r, false).answers)).toEqual(['mine']);
    expect(from(deal(r, false).prompts)).toEqual(['mine']);
    expect(from(deal(r, true).answers)).toEqual(['mine', 'classic', 'after', 'extra']);
    // Only answers were short: the lenders' prompts stay out.
    expect(from(deal(r, true).prompts)).toEqual(['mine']);
  });

  it('asks before other packs lend prompts when the picks have none, and falls back to Classic alone when no pick exists', () => {
    const answersOnly = pack('answers', 0, 200);
    const r = roomCards([answersOnly, dark], ['answers'], 3);
    expect([r.ask?.lenders, r.ask?.short, r.problem]).toEqual([['dark'], 'Your packs have no prompt cards.', '']);
    expect([from(deal(r, true).prompts), from(deal(r, true).answers)]).toEqual([['dark'], ['answers']]);
    expect(roomCards([classic, dark], ['gone'], 3).packs.map((p) => p.id)).toEqual(['classic']);
  });

  it('keeps a yes only for the same question', () => {
    const mine = pack('mine', 3, 12), all = [mine, pack('classic', 10, 70), dark];
    const three = roomCards(all, ['mine'], 3).ask!, ten = roomCards(all, ['mine'], 10).ask!;
    expect([three.lenders, ten.lenders]).toEqual([['classic'], ['classic', 'dark']]);
    expect(consent(three, '', '')).toBeNull();
    expect(consent(three, '', three.key)).toBe(three.key);
    expect(consent(roomCards(all, ['mine'], 4).ask, three.key, '')).toBe(three.key);
    expect(consent(ten, three.key, '')).toBeNull();
  });

  it('says why when no pack has prompts or answers at all', () => {
    expect(roomCards([pack('a', 0, 5)], ['a'], 3).problem).toBe('No pack has prompt cards');
    expect(roomCards([pack('a', 5, 0)], ['a'], 3).problem).toBe('No pack has answer cards');
  });

  it('treats lending answers and lending prompts from the same packs as two questions', () => {
    const answersShort = roomCards([pack('mine', 3, 12), classic], ['mine'], 3).ask!;
    const promptsShort = roomCards([pack('mine', 0, 200), classic], ['mine'], 3).ask!;
    expect([answersShort.lenders, promptsShort.lenders]).toEqual([['classic'], ['classic']]);
    expect(consent(promptsShort, answersShort.key, '')).toBeNull();
  });
});
