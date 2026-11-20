// Gate for built-in packs, including packs a Claude Code chat adds (see AGENTS.md):
// every pack must load, be well formed, and repeat nothing. Each test lists every problem
// it finds at once, so a new pack needs one fix-up pass, not one run per mistake.
import { describe, expect, it, vi } from 'vitest';
import { dedupe, gibberishPacks, quizBoards, slugify, spectrumPacks, wordDecks } from './content';
import { tabooPacks } from './content';
import { quickPacks } from './content';
import { snarkPacks, brawlPacks } from './content';
import { cardId, cardProblems } from '../games/taboo/cards';
import { songPacks } from './content';

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

describe('Big Board boards', () => {
  it('are well formed: 3–6 categories of 3–5 clues each, all the same length, no clue twice', () => {
    const problems: string[] = [];
    const boards = quizBoards();
    packBasics(boards, problems);
    for (const b of boards) {
      const cats = Array.isArray(b.categories) ? b.categories : [];
      if (cats.length < 3 || cats.length > 6) problems.push(`${b.id}: ${cats.length} categories (need 3–6)`);
      const len = cats[0]?.clues?.length ?? 0;
      if (len < 3 || len > 5) problems.push(`${b.id}: ${len} clues per category (need 3–5)`);
      const names = new Set<string>();
      const clues = new Set<string>();
      for (const c of cats) {
        if (!c.name?.trim()) problems.push(`${b.id}: a category has no name`);
        else if (names.has(key(c.name))) problems.push(`${b.id}: category "${c.name}" repeats`);
        names.add(key(c.name ?? ''));
        if (!Array.isArray(c.clues)) { problems.push(`${b.id}: "${c.name}" has no clues list`); continue; }
        if (c.clues.length !== len) problems.push(`${b.id}: "${c.name}" has ${c.clues.length} clues, the first category has ${len}`);
        for (const k of c.clues) {
          if (!k.clue?.trim()) problems.push(`${b.id}: "${c.name}" has an empty clue`);
          if (!k.answer?.trim()) problems.push(`${b.id}: "${c.name}": "${k.clue}" has no answer`);
          if (k.clue && clues.has(key(k.clue))) problems.push(`${b.id}: clue "${k.clue}" repeats`);
          clues.add(key(k.clue ?? ''));
        }
      }
    }
    expect(boards.length).toBeGreaterThanOrEqual(3);
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

describe("Don't Say It packs", () => {
  it('have five fair banned words per card and never repeat a word across packs', () => {
    const problems: string[] = [];
    const packs = tabooPacks();
    packBasics(packs, problems);
    const seen = new Map<string, string>();
    for (const p of packs) {
      if (p.cards.length < 20) problems.push(`${p.id}: only ${p.cards.length} cards (need 20+)`);
      for (const c of p.cards) {
        for (const why of cardProblems(c)) problems.push(`${p.id}: "${c.word}": ${why}`);
        const prev = seen.get(cardId(c));
        if (prev) problems.push(`${p.id}: "${c.word}" already exists in ${prev}`);
        seen.set(cardId(c), p.id);
      }
    }
    expect(packs.slice(0, 3).map((p) => p.id)).toEqual(['classic', 'pop-culture', 'after-dark']);
    expect(problems).toEqual([]);
  });
});

describe("Brain Freeze packs", () => {
  it("are 2–8 word lowercase prompts with no trailing punctuation, never repeated across packs", () => {
    const problems: string[] = [];
    const packs = quickPacks();
    packBasics(packs, problems);
    const seen = new Map<string, string>();
    for (const p of packs) {
      if (!Array.isArray(p.prompts) || p.prompts.length < 20) { problems.push(`${p.id}: only ${p.prompts?.length ?? 0} prompts (need 20+)`); continue; }
      for (const q of p.prompts) {
        if (typeof q !== "string" || !q.trim()) { problems.push(`${p.id}: an empty prompt`); continue; }
        const n = words(q);
        if (n < 2 || n > 8) problems.push(`${p.id}: "${q}" has ${n} words (need 2–8)`);
        if (!/^[a-z]/.test(q)) problems.push(`${p.id}: "${q}" should start with a lowercase letter (it follows "Name 3")`);
        if (/^name\s+(3|three)\b/i.test(q)) problems.push(`${p.id}: "${q}" should not include "Name 3"`);
        if (/[.,;:!?…]$/.test(q.trim())) problems.push(`${p.id}: "${q}" ends in punctuation`);
        if (q !== q.trim().replace(/\s+/g, " ")) problems.push(`${p.id}: "${q}" has extra spaces`);
        const prev = seen.get(key(q));
        if (prev) problems.push(`${p.id}: "${q}" already exists in ${prev}`);
        seen.set(key(q), p.id);
      }
    }
    expect(packs.slice(0, 3).map((p) => p.id)).toEqual(["classic", "pop-culture", "after-dark"]);
    expect(problems).toEqual([]);
  });
});

describe('Snark Tank packs', () => {
  it('are 3–14 word prompts, never repeated across packs', () => {
    const problems: string[] = [];
    const packs = snarkPacks();
    packBasics(packs, problems);
    const seen = new Map<string, string>();
    for (const p of packs) {
      if (!Array.isArray(p.prompts) || p.prompts.length < 20) { problems.push(`${p.id}: only ${p.prompts?.length ?? 0} prompts (need 20+)`); continue; }
      for (const q of p.prompts) {
        if (typeof q !== 'string' || !q.trim()) { problems.push(`${p.id}: an empty prompt`); continue; }
        const n = words(q);
        if (n < 3 || n > 14) problems.push(`${p.id}: "${q}" has ${n} words (need 3–14)`);
        if (q !== q.trim().replace(/\s+/g, ' ')) problems.push(`${p.id}: "${q}" has extra spaces`);
        const prev = seen.get(key(q));
        if (prev) problems.push(`${p.id}: "${q}" already exists in ${prev}`);
        seen.set(key(q), p.id);
      }
    }
    expect(packs.slice(0, 2).map((p) => p.id)).toEqual(['classic', 'after-dark']);
    expect(problems).toEqual([]);
  });
});

describe('Earworm packs', () => {
  it('hold real YouTube ids and start times, and never repeat a video or a song across packs', () => {
    const problems: string[] = [];
    const packs = songPacks();
    packBasics(packs, problems);
    const ids = new Map<string, string>();
    const songs = new Map<string, string>();
    for (const p of packs) {
      if (!Array.isArray(p.songs) || p.songs.length < 10) { problems.push(`${p.id}: only ${p.songs?.length ?? 0} songs (need 10+)`); continue; }
      for (const s of p.songs) {
        const name = `"${s.title}" by ${s.artist}`;
        if (!s.title?.trim() || !s.artist?.trim()) problems.push(`${p.id}: a song is missing its title or artist (${JSON.stringify(s)})`);
        if (!/^[A-Za-z0-9_-]{11}$/.test(s.youtube ?? '')) problems.push(`${p.id}: ${name}: "${s.youtube}" is not an 11-character YouTube video id`);
        if (typeof s.start !== 'number' || !Number.isInteger(s.start) || s.start < 0) problems.push(`${p.id}: ${name}: start should be a whole number of seconds, 0 or more`);
        const prevId = ids.get(s.youtube);
        if (prevId) problems.push(`${p.id}: ${name}: video ${s.youtube} already exists in ${prevId}`);
        ids.set(s.youtube, p.id);
        // Same title by the same lead artist, whoever is featured ("Timber" by Pitbull ft. Kesha).
        const k = `${key(s.title ?? '')} | ${key((s.artist ?? '').split(/\s+(?:ft\.|feat\.|featuring|&|and|x)\s+/i)[0])}`;
        const prevSong = songs.get(k);
        if (prevSong) problems.push(`${p.id}: ${name} already exists in ${prevSong}`);
        songs.set(k, p.id);
      }
    }
    expect(packs.slice(0, 3).map((p) => p.id)).toEqual(['2000s-bangers', '2010s-hits', 'throwbacks']);
    expect(problems).toEqual([]);
  });
});

describe('Doodle Brawl packs', () => {
  it('has short, unique titles across packs', () => {
    const seen = new Set<string>();
    const problems: string[] = [];
    for (const pack of brawlPacks()) {
      if (pack.titles.length < 24) problems.push(`${pack.id} needs at least 24 titles for a full room`);
      for (const title of pack.titles) {
        const key = title.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');
        const count = key.split(' ').length;
        if (count < 2 || count > 8 || !/^[A-Z]/.test(title) || /[.!?]$/.test(title)) problems.push(`Invalid title: ${title}`);
        if (seen.has(key)) problems.push(`Repeated title: ${title}`);
        seen.add(key);
      }
    }
    expect(problems).toEqual([]);
  });

  it('ships complete Classic and After Dark packs', () => {
    const packs = brawlPacks();
    expect(packs.find((p) => p.id === 'classic')?.titles).toHaveLength(120);
    expect(packs.find((p) => p.id === 'after-dark')?.titles).toHaveLength(60);
  });
});
