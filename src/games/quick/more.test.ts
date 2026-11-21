import { describe, expect, it, vi } from 'vitest';

const sent: { prompt: string }[] = [];
vi.mock('../../lib/claude', async (real) => ({
  ...(await real<typeof import('../../lib/claude')>()),
  streamLines: async (o: { prompt: string; onLine: (l: string) => void }) => {
    sent.push(o);
    ['Name 3 pizza toppings', 'things in a fridge.', 'board games', 'reasons to leave a party early', 'sports'].forEach(o.onLine);
  },
}));

const { morePrompts } = await import('./generate');

describe('morePrompts', () => {
  it('skips prompts in this pack, in other packs or already on screen, up to the count', async () => {
    const pack = { id: 'my-q', name: 'Food', blurb: '', prompts: ['pizza toppings'] };
    const got: string[] = [];
    await morePrompts(pack, ['board games'], { count: 2, steer: 'harder', avoid: ['things in a fridge'], onItem: (p) => got.push(p) });
    expect(sent[0].prompt).toContain('Write 2 more prompts');
    expect(sent[0].prompt).toMatch(/things in a fridge\npizza toppings/);
    expect(sent[0].prompt).toMatch(/other packs[^\n]*\nboard games/);
    expect(got).toEqual(['reasons to leave a party early', 'sports']);
  });
});
