import { describe, expect, it, vi } from 'vitest';

// A fake wizard: records each request and answers with the lines `reply` holds.
const sent: { system: string; prompt: string; maxTokens?: number }[] = [];
let reply: string[] = [];
vi.mock('./claude', () => ({
  streamLines: async (o: { system: string; prompt: string; maxTokens?: number; onLine: (l: string) => void }) => {
    sent.push(o);
    reply.forEach(o.onLine);
  },
}));

const { aboutOf, MAX_LISTED_CHARS, mergeOnTop, morePrompt, streamMore, within } = await import('./addMore');

describe('morePrompt', () => {
  it('carries the pack, the count, the steer and every item already there', () => {
    const p = morePrompt({ name: 'Road Trip', blurb: 'Conjured by Fizzwick: long drives', have: ['Gas Station', 'Rest Stop'], others: ['Map'] }, { count: 12, steer: ' more 90s ones ' }, 'items');
    expect(p).toContain('Pack: Road Trip');
    expect(p).toContain('About: long drives');
    expect(p).toContain('Write 12 more items');
    expect(p).toContain('The player asks for: more 90s ones');
    expect(p).toMatch(/Already in the pack, so never repeat[^\n]*\nGas Station\nRest Stop/);
    expect(p).toMatch(/other packs, so never use these either:\nMap$/);
  });

  it('leaves out an empty steer, a placeholder blurb and lists nobody gave', () => {
    const p = morePrompt({ name: 'Mine', blurb: 'Pasted list', have: [] }, { count: 5, steer: '  ' }, 'cards');
    expect(p).not.toMatch(/About|asks for|Already/);
  });

  it('keeps the lists within the request budget, the pack first', () => {
    const big = Array.from({ length: 5000 }, (_, i) => `Item number ${i}`);
    const p = morePrompt({ name: 'Big', blurb: '', have: big, others: ['Other one'] }, { count: 10, steer: '' }, 'items');
    expect(p.length).toBeLessThan(MAX_LISTED_CHARS + 1000);
    expect(p).toContain('Item number 0\n');
    expect(p).not.toContain('Other one');
  });
});

describe('within and aboutOf', () => {
  it('takes lines from the start until the budget is spent', () => {
    expect(within(['abc', 'def', 'ghi'], 8)).toEqual(['abc', 'def']);
  });
  it('drops the app’s own placeholder blurbs', () => {
    expect(aboutOf('Conjured by Fizzwick: Disney villains')).toBe('Disney villains');
    expect(aboutOf('Made on this phone')).toBe('');
    expect(aboutOf('12 prompts')).toBe('');
    expect(aboutOf('Dorms and finals')).toBe('Dorms and finals');
  });
});

describe('streamMore', () => {
  it('hands over only new, unique, readable items, at most the count asked', async () => {
    reply = ['Here you go:', 'Pizza', 'pizza', 'Taco', 'Sushi', 'Ramen', 'Burger'];
    const got: string[] = [];
    const n = await streamMore({
      system: 'S', prompt: 'P', count: 3, maxTokens: 1234,
      read: (l) => (l.endsWith(':') ? null : l), keyOf: (s) => s.toLowerCase(), taken: ['taco'],
      onItem: (s) => got.push(s),
    });
    expect(got).toEqual(['Pizza', 'Sushi', 'Ramen']);
    expect(n).toBe(3);
    expect(sent.at(-1)).toMatchObject({ system: 'S', prompt: 'P', maxTokens: 1234 });
  });
});

describe('mergeOnTop', () => {
  it('puts the kept items first and never adds one already there or twice', () => {
    expect(mergeOnTop(['a', 'b'], ['c', 'A', 'c', 'd'], (s) => s.toLowerCase())).toEqual(['c', 'd', 'a', 'b']);
  });
});
