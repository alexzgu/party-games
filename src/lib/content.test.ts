// Gate for built-in packs, including packs a Claude Code chat adds (see AGENTS.md):
// every pack must load, be well formed, and repeat nothing. Each test lists every problem
// it finds at once, so a new pack needs one fix-up pass, not one run per mistake.
import { describe, expect, it, vi } from 'vitest';
import { dedupe, gibberishPacks, quizBoards, slugify, spectrumPacks, wordDecks } from './content';
import { tabooPacks } from './content';
import { quickPacks } from './content';
import { brawlPacks, saladPacks, snarkPacks } from './content';
import { cardId, cardProblems } from '../games/taboo/cards';
import { normalise } from '../games/salad/match';
import { categories, followups, leaksAnswer, levels, opening, shared, type Secret } from '../games/salad/words';
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
  // Optional extras: stock answers for "Give me one" and finals for three-line duels. Shapes
  // only; a pack need not have one for every prompt.
  it('stock answers belong to their pack\'s prompts; finals are new prompts with three house lines', () => {
    const problems: string[] = [];
    const packs = snarkPacks();
    const regular = new Set(packs.flatMap((p) => (Array.isArray(p.prompts) ? p.prompts.map(key) : [])));
    const finals = new Map<string, string>();
    for (const p of packs) {
      if (p.safety !== undefined) {
        if (!p.safety || typeof p.safety !== 'object' || Array.isArray(p.safety)) problems.push(`${p.id}: "safety" should be an object of prompt → answer`);
        else for (const [q, a] of Object.entries(p.safety)) {
          if (!p.prompts.includes(q)) problems.push(`${p.id}: safety answer for "${q}", which is not one of this pack's prompts`);
          if (typeof a !== 'string' || !a.trim() || a.length > 80) problems.push(`${p.id}: safety answer for "${q}" should be 1–80 characters`);
        }
      }
      if (p.finals === undefined) continue;
      if (!Array.isArray(p.finals)) { problems.push(`${p.id}: "finals" should be a list`); continue; }
      for (const f of p.finals) {
        const q = typeof f?.prompt === 'string' ? f.prompt : '';
        if (!q.trim()) { problems.push(`${p.id}: a final with no prompt`); continue; }
        if (regular.has(key(q))) problems.push(`${p.id}: final "${q}" is also a regular prompt`);
        const prev = finals.get(key(q));
        if (prev) problems.push(`${p.id}: final "${q}" already exists in ${prev}`);
        finals.set(key(q), p.id);
        const house = f.house as unknown;
        if (!Array.isArray(house) || house.length !== 3 || !house.every((l) => typeof l === 'string' && l.trim() && l.length <= 40)) {
          problems.push(`${p.id}: final "${q}" needs exactly 3 house lines of 1–40 characters`);
        }
      }
    }
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

const nonemptyText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const textList = (value: unknown): value is string[] => Array.isArray(value) && value.every(nonemptyText);

function checkSaladWords(problems: string[], label: string, secret: Secret): void {
  const bank = secret.words;
  if (!bank || typeof bank !== 'object' || Array.isArray(bank)) {
    problems.push(`${label}: needs a word bank`);
    return;
  }
  for (const [slot, choices] of Object.entries(bank)) {
    if (!Object.prototype.hasOwnProperty.call(shared, slot)) problems.push(`${label}: unknown slot "${slot}"`);
    if (!textList(choices) || choices.length < 3 || choices.length > 8) {
      problems.push(`${label}: "${slot}" needs 3–8 nonempty choices`);
      continue;
    }
    if (new Set(choices.map(key)).size !== choices.length) problems.push(`${label}: "${slot}" has repeated choices`);
    for (const choice of choices) {
      if (leaksAnswer(choice, secret.answer)) problems.push(`${label}: "${choice}" contains an answer word`);
    }
  }
  if (!categories.includes(secret.category)) return;
  for (const slot of opening[secret.category].slots) {
    const choices = slot === 'guess' ? undefined : bank[slot];
    if (!textList(choices) || new Set(choices.map(key)).size < 3) {
      problems.push(`${label}: opening frame needs at least three distinct "${slot}" choices`);
    }
  }
}

describe('Word Salad packs', () => {
  it('have complete word banks and never repeat an answer across secrets', () => {
    const packs = saladPacks();
    const problems: string[] = [];
    const seen = new Map<string, string>();
    packBasics(packs, problems);
    for (const p of packs) {
      if (!Array.isArray(p.secrets) || !p.secrets.length) {
        problems.push(`${p.id}: needs a list of secrets`);
        continue;
      }
      for (const [index, secret] of p.secrets.entries()) {
        if (!nonemptyText(secret?.answer) || !normalise(secret.answer)) {
          problems.push(`${p.id}: secret ${index + 1} needs an answer`);
          continue;
        }
        const label = `${p.id}: "${secret.answer}"`;
        if (!categories.includes(secret.category)) problems.push(`${label}: unknown category`);
        if (!levels.includes(secret.level)) problems.push(`${label}: unknown difficulty`);
        if (!textList(secret.also)) problems.push(`${label}: "also" must be a list of accepted variants`);
        const aliases = textList(secret.also) ? secret.also : [];
        const names = new Set([secret.answer, ...aliases].map(normalise));
        for (const name of names) {
          if (!name) problems.push(`${label}: an accepted variant is missing a word`);
          const previous = seen.get(name);
          if (previous) problems.push(`${label}: "${name}" also identifies ${previous}`);
          seen.set(name, label);
        }
        checkSaladWords(problems, label, secret);
      }
    }
    expect(problems).toEqual([]);
  });

  it('has 16 Classic secrets per category with a 4/8/4 difficulty mix', () => {
    const classic = saladPacks().find((p) => p.id === 'classic');
    expect(classic?.secrets).toHaveLength(64);
    for (const category of categories) {
      const secrets = classic!.secrets.filter((s) => s.category === category);
      expect(levels.map((level) => secrets.filter((s) => s.level === level).length)).toEqual([4, 8, 4]);
    }
  });

  it('has valid frames, comparison slots and enough different words to redeal', () => {
    for (const bank of Object.values(shared)) {
      expect(new Set(bank.map(key)).size).toBe(bank.length);
      expect(bank.length).toBeGreaterThanOrEqual(60);
      expect(bank.length).toBeLessThanOrEqual(150);
    }
    for (const category of categories) {
      expect(followups[category].length).toBeGreaterThanOrEqual(10);
      expect(followups[category].length).toBeLessThanOrEqual(16);
      expect(followups[category].filter((f) => f.slots.includes('guess'))).toHaveLength(3);
      for (const f of [opening[category], ...followups[category]]) {
        expect(f.text.split('___')).toHaveLength(f.slots.length + 1);
        expect(f.slots.every((slot) => slot === 'guess' || Object.hasOwn(shared, slot))).toBe(true);
      }
    }
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
