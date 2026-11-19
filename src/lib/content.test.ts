// Gate for built-in packs, including packs a Claude Code chat adds (see AGENTS.md):
// every pack must load, be well formed, and repeat nothing. Each test lists every problem
// it finds at once, so a new pack needs one fix-up pass, not one run per mistake.
import { describe, expect, it, vi } from 'vitest';
import { dedupe, gibberishPacks, slugify, spectrumPacks, wordDecks } from './content';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Small words a phrase may share with its answer without giving it away. */
const FILLER = new Set(['the', 'and', 'for', 'you', 'with', 'are', 'its', 'not', 'but', 'all', 'her', 'his', 'our', 'out', 'off']);
const words = (s: string) => s.trim().split(/\s+/).length;
const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function packBasics(packs: { id: string; name: string; blurb: string }[], problems: string[]) {
  const ids = new Set<string>();
  for (const p of packs) {
    if (ids.has(p.id)) problems.push(`duplicate pack id "${p.id}"`);
    ids.add(p.id);
    if (!SLUG.test(p.id)) problems.push(`bad id "${p.id}" (use lowercase-with-dashes)`);
    if (!p.name?.trim()) problems.push(`${p.id}: missing name`);
    if (!p.blurb?.trim()) problems.push(`${p.id}: missing blurb`);
    const added = (p as { added?: string }).added;
    if (added !== undefined && !/^\d{4}-\d{2}-\d{2}/.test(added)) problems.push(`${p.id}: "added" should be a date like 2026-11-21`);
  }
}

describe('Heads Down. decks', () => {
  it('are well formed', () => {
    const problems: string[] = [];
    const decks = wordDecks();
    packBasics(decks, problems);
    for (const d of decks) {
      if (!d.emoji?.trim()) problems.push(`${d.id}: missing emoji`);
      if (d.words.length < 20) problems.push(`${d.id}: only ${d.words.length} words (need 20+)`);
      const seen = new Set<string>();
      for (const w of d.words) {
        if (words(w) > 4) problems.push(`${d.id}: "${w}" is over 4 words`);
        if (/[.,;:!?]$/.test(w)) problems.push(`${d.id}: "${w}" ends in punctuation`);
        if (seen.has(key(w))) problems.push(`${d.id}: "${w}" repeats`);
        seen.add(key(w));
      }
    }
    expect(decks.length).toBeGreaterThanOrEqual(16);
    expect(problems).toEqual([]);
  });
});

describe('Spectrum packs', () => {
  it('are well formed and never repeat a scale, even reversed', () => {
    const problems: string[] = [];
    const packs = spectrumPacks();
    packBasics(packs, problems);
    const seen = new Map<string, string>();
    for (const p of packs) {
      if (p.cards.length < 10) problems.push(`${p.id}: only ${p.cards.length} cards (need 10+)`);
      for (const c of p.cards) {
        for (const side of [c.left, c.right]) {
          if (!side?.trim()) problems.push(`${p.id}: empty side in "${c.left} | ${c.right}"`);
          else if (words(side) > 5) problems.push(`${p.id}: "${side}" is over 5 words`);
        }
        const k = [key(c.left), key(c.right)].sort().join(' | ');
        const prev = seen.get(k);
        if (prev) problems.push(`${p.id}: "${c.left} | ${c.right}" already exists in ${prev}`);
        seen.set(k, p.id);
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('Inn Co Hear Ant packs', () => {
  it('are well formed, never give the answer away, and never repeat an answer', () => {
    const problems: string[] = [];
    const packs = gibberishPacks();
    packBasics(packs, problems);
    const answers = new Map<string, string>();
    for (const p of packs) {
      if (p.cards.length < 10) problems.push(`${p.id}: only ${p.cards.length} cards (need 10+)`);
      for (const c of p.cards) {
        if (!c.hint?.trim() || words(c.hint) > 3) problems.push(`${p.id}: hint "${c.hint}" should be 1–3 words`);
        const phrase = new Set(c.phrase.toLowerCase().split(/\s+/));
        const giveaway = c.answer
          .toLowerCase()
          .split(/[\s'-]+/)
          .filter((w) => w.length > 2 && !FILLER.has(w) && phrase.has(w));
        if (giveaway.length) problems.push(`${p.id}: "${c.phrase}" contains answer word(s) ${giveaway.join(', ')}`);
        const a = key(c.answer);
        const prev = answers.get(a);
        if (prev) problems.push(`${p.id}: answer "${c.answer}" already exists in ${prev}`);
        answers.set(a, p.id);
      }
    }
    expect(packs.slice(0, 4).map((p) => p.id)).toEqual(['classic', 'pop', 'sayings', 'after-dark']);
    expect(problems).toEqual([]);
  });
});

describe('helpers', () => {
  it('dedupes ignoring case and spacing', () => {
    expect(dedupe(['Cat', ' cat', 'Big  Dog', 'big dog', ''])).toEqual(['Cat', 'Big Dog']);
  });
  it('slugifies names', () => {
    expect(slugify('2000s Cartoons!')).toBe('2000s-cartoons');
  });
});

describe('editing built-in packs', () => {
  it('replaces the built-in in place until restored, and is not listed as the player\'s own', async () => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) });
    const { customDecks } = await import('./content');
    const first = wordDecks().find((d) => !d.custom)!;
    customDecks.put({ ...first, words: ['Only Word'] });
    const after = wordDecks();
    expect(after.filter((d) => d.id === first.id)).toHaveLength(1);
    expect(after.find((d) => d.id === first.id)!.words).toEqual(['Only Word']);
    expect(after.find((d) => d.id === first.id)!.custom).toBe(false);
    expect(customDecks.isEdited(first.id)).toBe(true);
    expect(customDecks.all().some((d) => d.id === first.id)).toBe(false);
    customDecks.restore(first.id);
    expect(customDecks.isEdited(first.id)).toBe(false);
    expect(wordDecks().find((d) => d.id === first.id)!.words).toEqual(customDecks.original(first.id)!.words);
    vi.unstubAllGlobals();
  });
});

describe('own packs that share an id with a built-in', () => {
  it('stay the player\'s own under a new id', async () => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) });
    const { customDecks } = await import('./content');
    const builtinId = wordDecks().find((d) => !d.custom)!.id;
    mem.set('hr:custom:decks', JSON.stringify([{ id: builtinId, name: 'Mine', emoji: '📝', blurb: '', words: ['A'], custom: true }]));
    expect(customDecks.isEdited(builtinId)).toBe(false);
    expect(customDecks.all().map((d) => d.id)).toEqual(['my-' + builtinId]);
    vi.unstubAllGlobals();
  });
});
