import { describe, expect, it, vi } from 'vitest';

// A fake wizard: records the request and answers with fixed lines.
const sent: { prompt: string }[] = [];
vi.mock('../../lib/claude', async (real) => ({
  ...(await real<typeof import('../../lib/claude')>()),
  streamLines: async (o: { prompt: string; onLine: (l: string) => void }) => {
    sent.push(o);
    ['1. Pizza Rat', 'Moon Landing', 'moon landing', 'Taylor Swift', 'Hot Dog', 'Karaoke'].forEach(o.onLine);
  },
}));

const { moreWords } = await import('./generate');

describe('moreWords', () => {
  it('asks with the pack and every word on screen, and hands over only new words, up to the count', async () => {
    const deck = { id: 'my-x', name: 'Party Night', emoji: '🎉', blurb: 'Conjured by Fizzwick: parties', words: ['Moon Landing'] };
    const got: string[] = [];
    const n = await moreWords(deck, { count: 3, steer: 'more 2000s', avoid: ['Pizza Rat'], onItem: (w) => got.push(w) });
    expect(sent[0].prompt).toContain('Write 3 more items');
    expect(sent[0].prompt).toContain('Pack: Party Night');
    expect(sent[0].prompt).toContain('The player asks for: more 2000s');
    expect(sent[0].prompt).toMatch(/Pizza Rat\nMoon Landing/);
    expect(got).toEqual(['Taylor Swift', 'Hot Dog', 'Karaoke']);
    expect(n).toBe(3);
  });
});
