import { describe, expect, it, vi } from 'vitest';

const sent: { system: string; prompt: string }[] = [];
vi.mock('../../lib/claude', () => ({
  streamLines: async (o: { system: string; prompt: string; onLine: (l: string) => void }) => {
    sent.push(o);
    ['Here you go:', 'Eye Scream | Ice Cream | Food', 'Bee Yawn Say | Beyoncé | Singer', 'Bee Yawn Say | Beyonce | Singer', 'Moan A Lease Ah | Mona Lisa'].forEach(o.onLine);
  },
}));

const { generateCards } = await import('./generate');

describe('generateCards', () => {
  it('asks to avoid known answers and keeps only new, well-formed cards', async () => {
    const got: string[] = [];
    await generateCards({ theme: 'art', existing: [{ phrase: 'x', answer: 'Mona Lisa', hint: '' }], onCard: (c) => got.push(`${c.answer}/${c.hint}`) });
    expect(sent[0].prompt).toContain('Mona Lisa');
    expect(sent[0].system).toMatch(/real English dictionary word/);
    // Ice Cream is a built-in example, the accent-free Beyonce is a repeat, Mona Lisa is already in the pack.
    expect(got).toEqual(['Beyoncé/Singer']);
  });
});
