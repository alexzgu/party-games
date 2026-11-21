import { describe, expect, it, vi } from 'vitest';

const sent: { prompt: string }[] = [];
vi.mock('../../lib/claude', async (real) => ({
  ...(await real<typeof import('../../lib/claude')>()),
  streamLines: async (o: { prompt: string; onLine: (l: string) => void }) => {
    sent.push(o);
    ['Cold | Hot', 'Cheap | Expensive', 'Quiet | Loud', 'nonsense line', 'Bad movie | Good movie'].forEach(o.onLine);
  },
}));

const { moreCards } = await import('./generate');

describe('moreCards', () => {
  it('never brings back a scale from this pack or any other, and lists both in the request', async () => {
    const pack = { id: 'my-p', name: 'Mixed', blurb: '', cards: [{ left: 'Cold', right: 'Hot' }] };
    const got: string[] = [];
    await moreCards(pack, [{ left: 'Quiet', right: 'Loud' }], { count: 10, steer: '', avoid: [], onItem: (c) => got.push(`${c.left}|${c.right}`) });
    expect(sent[0].prompt).toContain('Write 10 more cards');
    expect(sent[0].prompt).toMatch(/Already in the pack[^\n]*\nCold \| Hot/);
    expect(sent[0].prompt).toMatch(/other packs[^\n]*\nQuiet \| Loud/);
    expect(got).toEqual(['Cheap|Expensive', 'Bad movie|Good movie']);
  });
});
