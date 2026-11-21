// What a published pack may hold and what a list request may ask, without the server around them.
import { describe, expect, it } from 'vitest';
import { checkList, checkPublish, LIBRARY } from './library';

const pack = (over: Record<string, unknown> = {}) => JSON.stringify({ game: 'forehead', name: 'Cartoons', blurb: 'Saturday mornings', localId: 'my-cartoons', items: ['SpongeBob', 'Shrek'], ...over });
const problem = (over: Record<string, unknown>) => {
  const r = checkPublish(pack(over));
  return r.ok ? '' : r.message;
};

describe('checkPublish', () => {
  it('keeps a good pack, trimmed, with its count and only the extras its game has', () => {
    const r = checkPublish(pack({ name: '  Cartoons ', extra: { emoji: '📺', safety: { a: 'b' } } }));
    expect(r).toEqual({ ok: true, value: { game: 'forehead', name: 'Cartoons', blurb: 'Saturday mornings', localId: 'my-cartoons', items: ['SpongeBob', 'Shrek'], extra: { emoji: '📺' }, count: 2 } });
    const snark = checkPublish(pack({ game: 'snark', items: ['A bad name for a boat'], extra: { emoji: 'x', safety: { 'A bad name for a boat': 'Floaty' }, finals: [] } }));
    expect(snark.ok && snark.value.extra).toEqual({ safety: { 'A bad name for a boat': 'Floaty' } });
  });

  it('keeps only the fields each game uses, and only good stock answers and finals', () => {
    const dial = checkPublish(pack({ game: 'dial', items: [{ left: ' Hot ', right: 'Cold', evil: { deep: [[[1]]] }, __proto__x: 1 }], extra: { safety: {} } }));
    expect(dial.ok && dial.value.items).toEqual([{ left: 'Hot', right: 'Cold' }]);
    expect(dial.ok && dial.value.extra).toEqual({});
    const finals = [
      { prompt: 'Three things to never say on a boat', house: ['Iceberg', 'Oops', 'Swim?'], junk: {} },
      { prompt: 'Two lines only', house: ['a', 'b'] },
      { prompt: 'Too long a line', house: ['a', 'b', 'x'.repeat(41)] },
      { prompt: { nested: true }, house: ['a', 'b', 'c'] },
    ];
    const safety = { 'A bad name for a boat': 'Floaty', 'Not a prompt here': 'Nope', 'Another one please': { deep: 1 } };
    const snark = checkPublish(pack({ game: 'snark', items: ['A bad name for a boat', 'Another one please'], extra: { emoji: 'x', safety, finals } }));
    expect(snark.ok && snark.value.extra).toEqual({ safety: { 'A bad name for a boat': 'Floaty' }, finals: [{ prompt: 'Three things to never say on a boat', house: ['Iceberg', 'Oops', 'Swim?'] }] });
    // A prompt called "__proto__" stays a plain key: no prototype is ever set.
    const proto = checkPublish('{"game":"snark","name":"P","localId":"p","items":["__proto__"],"extra":{"safety":{"__proto__":"Sneaky"}}}');
    const stock = proto.ok ? (proto.value.extra.safety as Record<string, string>) : {};
    expect([Object.getPrototypeOf(stock) === Object.prototype, Object.hasOwn(stock, '__proto__'), stock['__proto__' as string]]).toEqual([true, true, 'Sneaky']);
    const taboo = checkPublish(pack({ game: 'taboo', items: [{ word: 'Dorm', banned: ['Bed', 'Roommate'], more: 'x' }] }));
    expect(taboo.ok && taboo.value.items).toEqual([{ word: 'Dorm', banned: ['Bed', 'Roommate'] }]);
  });

  it('caps a Big Board at 8 categories of 10 tiles, blank ones included', () => {
    const cat = (n: number) => ({ name: 'C', clues: Array.from({ length: n }, (_, i) => ({ clue: i ? '' : 'One', answer: '' })) });
    expect(problem({ game: 'quiz', items: Array.from({ length: 8 }, () => cat(10)) })).toBe('');
    expect(problem({ game: 'quiz', items: Array.from({ length: 9 }, () => cat(1)) })).toMatch(/at most 8 categories/);
    expect(problem({ game: 'quiz', items: [cat(11)] })).toMatch(/not quiz items/);
    expect(problem({ game: 'quiz', items: [{ name: 'C', clues: [{ clue: '', answer: '' }] }] })).toMatch(/at least one written/);
  });

  it('keeps a Heads Down. icon only when it is exactly one character', () => {
    const icon = (emoji: unknown) => { const r = checkPublish(pack({ extra: { emoji } })); return r.ok ? r.value.extra.emoji : 'refused'; };
    expect(['👩‍🚀', '🇯🇵', '👍🏽', 'Z', 'e\u0301', '🃏'].map(icon)).toEqual(['👩‍🚀', '🇯🇵', '👍🏽', 'Z', 'e\u0301', '🃏']);
    expect(['AB', '🎉🎉', ' 🎉', '', 'e' + '\u0301'.repeat(40), { deep: 1 }].map(icon)).toEqual(Array(6).fill(undefined));
  });

  it('counts a Big Board by its written clues', () => {
    const categories = [{ name: 'A', clues: [{ clue: 'One', answer: '1' }, { clue: '', answer: '' }] }, { name: 'B', clues: [{ clue: 'Two', answer: '2' }, { clue: 'Three', answer: '3' }] }];
    const r = checkPublish(pack({ game: 'quiz', items: categories }));
    expect(r.ok && r.value.count).toBe(3);
  });

  it('refuses a bad game, name, blurb, id or items', () => {
    expect(problem({ game: 'salad' })).toMatch(/^game must be/);
    expect(problem({ name: '   ' })).toMatch(/^name/);
    expect(problem({ name: 'x'.repeat(LIBRARY.nameMax + 1) })).toMatch(/^name/);
    expect(problem({ name: 'x'.repeat(LIBRARY.nameMax) })).toBe('');
    expect(problem({ blurb: 'x'.repeat(LIBRARY.blurbMax + 1) })).toMatch(/^blurb/);
    expect(problem({ blurb: 7 })).toMatch(/^blurb/);
    expect(problem({ localId: '' })).toMatch(/^localId/);
    expect(problem({ items: [] })).toMatch(/^items/);
    expect(problem({ items: 'SpongeBob' })).toMatch(/^items/);
    expect(problem({ items: [{ word: 'SpongeBob' }] })).toMatch(/not forehead items/);
    expect(problem({ game: 'dial', items: [{ left: 'Hot' }] })).toMatch(/not dial items/);
    expect(problem({ game: 'taboo', items: [{ word: 'Dorm', banned: ['Bed', 5] }] })).toMatch(/not taboo items/);
    expect(checkPublish('not json')).toEqual({ ok: false, message: 'Send the pack as JSON.' });
  });

  it(`caps a pack at ${LIBRARY.itemsMax} items and ${LIBRARY.itemsBytes / 1024} KB`, () => {
    const many = Array.from({ length: LIBRARY.itemsMax }, (_, i) => `Word ${i}`);
    expect(problem({ items: many })).toBe('');
    expect(problem({ items: [...many, 'One more'] })).toMatch(/at most 400 items/);
    const long = Array.from({ length: 380 }, (_, i) => `${i} ${'y'.repeat(190)}`);
    expect(problem({ game: 'quick', items: long })).toMatch(/limited to 64 KB/);
  });
});

describe('checkList', () => {
  it('defaults to the first page by stars, and lowercases the search', () => {
    expect(checkList(new URLSearchParams('game=dial&q=  Road   TRIP '))).toEqual({ ok: true, value: { game: 'dial', q: 'road trip', sort: 'stars', page: 1 } });
    expect(checkList(new URLSearchParams(''))).toEqual({ ok: true, value: { game: null, q: '', sort: 'stars', page: 1 } });
  });
  it('refuses a game, sort or page it does not know', () => {
    for (const q of ['game=song', 'sort=best', 'page=0', 'page=-1', 'page=2.5', `page=${LIBRARY.pageMax + 1}`]) expect(checkList(new URLSearchParams(q)).ok).toBe(false);
  });
});
