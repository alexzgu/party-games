import { describe, expect, it, vi } from 'vitest';

// A fake wizard: records each request and answers with the lines `reply` holds.
const sent: { system: string; prompt: string }[] = [];
let reply: string[] = [];
vi.mock('../../lib/claude', async (real) => ({
  ...(await real<typeof import('../../lib/claude')>()),
  streamLines: async (o: { system: string; prompt: string; onLine: (l: string) => void }) => {
    sent.push(o);
    reply.forEach(o.onLine);
  },
}));

const { generateItems, moreItems, readLine } = await import('../../lib/listWizard');
const { SYSTEM, WIZARD } = await import('./generate');

describe('Bad Hand wizard lines', () => {
  it('reads prompts and answers by their label, tidied, and drops lines that break the rules', () => {
    expect(readLine(WIZARD, '1. **Prompt:** my RA wrote me up for ___')).toEqual({ field: 'prompts', text: 'My RA wrote me up for ___' });
    expect(readLine(WIZARD, 'Answer: "a suspiciously large rice cooker."')).toEqual({ field: 'answers', text: 'A suspiciously large rice cooker' });
    expect(readLine(WIZARD, 'A suspiciously large rice cooker')).toBeNull(); // no label
    expect(readLine(WIZARD, 'Prompt: No blank and no question')).toBeNull();
    expect(readLine(WIZARD, 'Prompt: ___, ___ and ___')).toBeNull(); // three blanks
    expect(readLine(WIZARD, `Answer: ${'very '.repeat(10)}long`)).toBeNull(); // over 10 words
    expect(SYSTEM).toMatch(/at most two blanks/);
  });

  it('asks for four answers a prompt, keeps to the counts and never repeats a card in use', async () => {
    sent.length = 0;
    reply = ['Prompt: Why is ___ my problem?', 'Prompt: What got me through finals?', 'Prompt: My landlord fixes the heat with ___', 'Answer: Spite', 'Answer: Glitter'];
    const got: unknown[] = [];
    const n = await generateItems(WIZARD, { theme: 'College', count: 1, avoid: [{ field: 'prompts', text: 'Why is ___ my problem?' }], onItem: (i) => got.push(i) });
    expect(n).toBe(3);
    expect(got).toEqual([{ field: 'prompts', text: 'What got me through finals?' }, { field: 'answers', text: 'Spite' }, { field: 'answers', text: 'Glitter' }]);
    expect(sent[0].prompt).toContain('Write 1 prompt and 4 answers that fit the theme.');
    expect(sent[0].prompt).toMatch(/already in use[^\n]*\nPrompt: Why is ___ my problem\?$/);
    const pack = { id: 'dorms', name: 'Dorms', blurb: 'College', prompts: ['Why is ___ my problem?'], answers: ['Spite'] };
    reply = ['Answer: Spite', 'Answer: Ramen at 4am'];
    const more: unknown[] = [];
    await moreItems(WIZARD, pack, [], { count: 5, steer: '', avoid: [], onItem: (i) => more.push(i) });
    expect(more).toEqual([{ field: 'answers', text: 'Ramen at 4am' }]);
    expect(sent[1].prompt).toContain('Write 5 more prompts and 20 answers for this pack');
    expect(sent[1].prompt).toContain('Answer: Spite');
  });
});
