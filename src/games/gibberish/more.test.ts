import { describe, expect, it, vi } from 'vitest';

const sent: { prompt: string }[] = [];
vi.mock('../../lib/claude', async (real) => ({
  ...(await real<typeof import('../../lib/claude')>()),
  streamLines: async (o: { prompt: string; onLine: (l: string) => void }) => {
    sent.push(o);
    ['Eye Scream | Ice Cream | Food', 'Moan A Lease Ah | Mona Lisa', 'Bee Yawn Say | Beyoncé | Singer', 'Sand A Claws | Santa Claus | Holiday', 'Hair Eye Pot Her | Harry Potter', 'Spare Ah Gus | Asparagus'].forEach(o.onLine);
  },
}));

const { moreCards } = await import('./generate');

describe('moreCards (Inn Co Hear Ant)', () => {
  it('lists the answers in use and skips any answer used anywhere, filling a missing category from the pack', async () => {
    const pack = { id: 'my-a', name: 'Art', blurb: '', cards: [{ phrase: 'x', answer: 'Beyonce', hint: 'Singer' }, { phrase: 'y', answer: 'Prince', hint: 'Singer' }] };
    const got: string[] = [];
    await moreCards(pack, [{ phrase: 'z', answer: 'Santa Claus', hint: 'Holiday' }], { count: 10, steer: '', avoid: [], onItem: (c) => got.push(`${c.answer}/${c.hint}`) });
    expect(sent[0].prompt).toMatch(/Already in the pack \(their answers\)[^\n]*\nBeyonce\nPrince/);
    expect(sent[0].prompt).toMatch(/other packs \(their answers\)[^\n]*\nSanta Claus/);
    // Ice Cream and Harry Potter are system-prompt examples, Beyoncé is in the pack, Santa Claus in another pack.
    expect(got).toEqual(['Mona Lisa/Singer', 'Asparagus/Singer']);
  });
});
