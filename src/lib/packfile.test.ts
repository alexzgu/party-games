import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PackGameId } from '../app.config';
import { customDecks, wordDecks } from './content';
import { exportFile, fileName, freshId, freshName, importMessage, importPacks, MAX_FILE_BYTES, readFile, type AnyPack } from './packfile';

const SAMPLES: Record<PackGameId, AnyPack> = {
  forehead: { id: 'our-trip', name: 'Our Trip', emoji: '🚗', blurb: 'Summer 2026', words: ['Road Trip', 'Gas Station', 'Taylor Swift'] },
  dial: { id: 'college', name: 'College', blurb: 'Dorms and finals', cards: [{ left: 'Easy class', right: 'Hard class' }, { left: 'Cold', right: 'Hot' }] },
  gibberish: { id: 'snacks', name: 'Snacks', blurb: 'Treats', cards: [{ phrase: 'Eye Scream', answer: 'Ice Cream', hint: 'Food' }] },
  quiz: { id: 'space', name: 'Space', blurb: 'Up there', categories: [
    { name: 'Planets', clues: [{ clue: 'The Red Planet.', answer: 'Mars' }, { clue: 'The biggest planet.', answer: 'Jupiter' }] },
    { name: 'People', clues: [{ clue: 'First on the Moon.', answer: 'Neil Armstrong' }, { clue: '', answer: '' }] },
  ] },
  quick: { id: 'kitchen', name: 'Kitchen', blurb: 'Food', prompts: ['things in a fridge', 'songs by Taylor Swift'] },
  snark: { id: 'boats', name: 'Boats', blurb: 'At sea', prompts: ['A terrible name for a boat', 'The worst thing to hear from your pilot'] },
  taboo: { id: 'food', name: 'Food', blurb: 'Eat', cards: [{ word: 'Pizza', banned: ['Cheese', 'Slice', 'Pepperoni', 'Italian', 'Delivery'] }] },
  brawl: { id: 'office', name: 'Office', blurb: 'Work', titles: ["World's okayest intern", 'Undefeated at hiding in meetings'] },
  hand: { id: 'dorms', name: 'Dorms', blurb: 'College', prompts: ['My RA wrote me up for ___', 'What got me through finals?'], answers: ['A suspiciously large rice cooker', 'Crying in the stairwell'] },
  sketch: { id: 'camp', name: 'Camp', blurb: 'Outdoors', words: ['Tent', "S'more", 'Canoe'], ideas: ['A bear roasting marshmallows'] },
  rather: { id: 'powers', name: 'Powers', blurb: 'Pick one', prompts: ['be able to fly or be invisible', 'read minds or see the future'] },
  trivia: { id: 'space', name: 'Space', blurb: 'Up there', questions: ['Science | Which planet is known as the Red Planet? | Mars | Venus | Jupiter | Mercury'] },
};

const file = (game: string, packs: unknown[]) => JSON.stringify({ jerkBox: 1, game, packs });

describe('pack files', () => {
  it.each(Object.keys(SAMPLES) as PackGameId[])('%s: a pack exported and read back is the same pack', (game) => {
    const stored = { ...SAMPLES[game], custom: true, added: '2026-11-20T10:00:00.000Z' };
    const r = readFile(exportFile(game, [stored]), game);
    expect(r).toEqual({ packs: [SAMPLES[game]], skipped: 0, problems: [] });
  });

  it('carries a Snark pack\'s stock answers and finals, dropping broken ones', () => {
    const extras = {
      safety: { 'A terrible name for a boat': 'The Sinker' },
      finals: [{ prompt: 'Three things you never say on a boat', house: ['Iceberg!', 'Who can swim?', 'Oops'] }],
    };
    const full = { ...SAMPLES.snark, ...extras };
    expect(readFile(exportFile('snark', [full]), 'snark')).toEqual({ packs: [full], skipped: 0, problems: [] });
    const broken = {
      ...SAMPLES.snark,
      safety: { ...extras.safety, 'Not a prompt here': 'x', 'The worst thing to hear from your pilot': 'y'.repeat(81) },
      finals: [...extras.finals, { prompt: 'Three more things', house: ['one', 'two'] }, { prompt: 'Three long ones', house: ['a', 'b', 'c'.repeat(41)] }],
    };
    expect(readFile(file('snark', [broken]), 'snark')).toEqual({ packs: [full], skipped: 0, problems: [] });
  });

  it('checks each list of a two-list pack with its own rules, and reads a pack with one list left out', () => {
    const hand = { ...SAMPLES.hand, prompts: ['My RA wrote me up for ____', 'No blank here', 'what got me through finals?'], answers: ['a rice cooker.', 'x'.repeat(61), 'A rice cooker'] };
    expect(readFile(file('hand', [hand]), 'hand')).toEqual({
      packs: [{ ...SAMPLES.hand, prompts: ['My RA wrote me up for ___', 'What got me through finals?'], answers: ['A rice cooker'] }], skipped: 3, problems: [],
    });
    const ideas = { id: 'chains', name: 'Chains', blurb: '', ideas: ['A cat filing its taxes'] };
    expect(readFile(file('sketch', [ideas]), 'sketch')).toEqual({ packs: [{ ...ideas, words: [] }], skipped: 0, problems: [] });
    expect(readFile(file('sketch', [{ id: 'x', name: 'Empty', blurb: '' }]), 'sketch')).toEqual({ error: '“Empty” has no items in it.' });
    expect(readFile(file('brawl', [{ ...SAMPLES.brawl, titles: ['Solo', 'Best at naps.'] }]), 'brawl')).toEqual({ packs: [{ ...SAMPLES.brawl, titles: ['Best at naps'] }], skipped: 1, problems: [] });
    const rather = { ...SAMPLES.rather, prompts: ['Would you rather fly or swim?', 'nap all day', 'swim or fly'] };
    expect(readFile(file('rather', [rather]), 'rather')).toEqual({ packs: [{ ...SAMPLES.rather, prompts: ['fly or swim'] }], skipped: 2, problems: [] });
    const trivia = { ...SAMPLES.trivia, questions: ['Science|Which planet is known as the Red Planet?|Mars.|Venus|Jupiter|Mercury', 'Science | Name a planet | Mars | Venus', 'Science | Which planet is known as the red planet | Mars | Venus | Jupiter | Saturn'] };
    expect(readFile(file('trivia', [trivia]), 'trivia')).toEqual({ packs: [SAMPLES.trivia], skipped: 2, problems: [] });
  });

  it('names the file after the game and the pack', () => {
    expect(fileName('forehead', 'our-trip')).toBe('heads-down-our-trip.jerkbox.txt');
    expect(fileName('quiz')).toBe('big-board-my-packs.jerkbox.txt');
  });

  it('sends a file of another game to that game', () => {
    expect(readFile(exportFile('dial', [SAMPLES.dial]), 'forehead')).toEqual({ error: 'This file is a Spectrum pack; open Spectrum to import it.' });
  });

  it('names a game no longer in the app, even in a file too big to read', () => {
    const gone = { error: 'Earworm is no longer in Jerk Box.' };
    const old = JSON.stringify({ jerkBox: 1, game: 'song', packs: [{ id: 'pop', name: 'Pop', blurb: '', songs: [] }] }, null, 2);
    expect(readFile(old, 'forehead')).toEqual(gone);
    const clips = JSON.stringify({ jerkBox: 1, game: 'song', packs: [], clips: { x: 'a'.repeat(MAX_FILE_BYTES) } });
    expect(readFile(clips, 'quiz')).toEqual(gone);
    expect(readFile(file('dial', [{ big: 'a'.repeat(MAX_FILE_BYTES) }]), 'dial')).toEqual({ error: 'That file is too big to be a pack file.' });
  });

  it('refuses anything that is not a pack file', () => {
    const notOurs = { error: "This isn't a Jerk Box pack file." };
    expect(readFile('not json {', 'forehead')).toEqual(notOurs);
    expect(readFile('{"hello": 1}', 'forehead')).toEqual(notOurs);
    expect(readFile('[1, 2]', 'forehead')).toEqual(notOurs);
    expect(readFile(file('chess', []), 'forehead')).toEqual(notOurs);
    expect(readFile(file('forehead', []), 'forehead')).toEqual({ error: 'This file has no packs in it.' });
  });

  it('drops the items that fail the game\'s own checks, with a count', () => {
    const forehead = readFile(file('forehead', [{ id: 'x', name: 'X', blurb: '', emoji: '🎉', words: ['Good', '', 42, 'Far Too Many Words Here', 'good'] }]), 'forehead');
    expect(forehead).toEqual({ packs: [{ id: 'x', name: 'X', blurb: '', emoji: '🎉', words: ['Good'] }], skipped: 4, problems: [] });
    // Any one character is an icon: a joined emoji or a flag stays whole, more is cut to the first, none is the default.
    const icons = ['👩‍🚀', '🇯🇵', 'Q', 'AB', '', 42].map((emoji) => readFile(file('forehead', [{ id: 'x', name: 'X', emoji, words: ['Good'] }]), 'forehead'));
    expect(icons.map((r) => ('packs' in r ? (r.packs[0] as { emoji: string }).emoji : r.error))).toEqual(['👩‍🚀', '🇯🇵', 'Q', 'A', '🃏', '🃏']);
    const taboo = readFile(file('taboo', [{ ...SAMPLES.taboo, cards: [...(SAMPLES.taboo as { cards: unknown[] }).cards, { word: 'Beach', banned: ['Sand', 'Sun'] }] }]), 'taboo');
    expect(taboo).toMatchObject({ packs: [SAMPLES.taboo], skipped: 1 });
  });

  it('leaves out a pack with nothing usable, and says why', () => {
    const r = readFile(file('snark', [SAMPLES.snark, { id: 'bad', name: 'Bad', blurb: '', prompts: ['x', 7] }]), 'snark');
    expect(r).toEqual({ packs: [SAMPLES.snark], skipped: 0, problems: ['None of the prompts in “Bad” could be used.'] });
    expect(readFile(file('snark', [{ id: 'bad', name: 'Bad', prompts: ['x'] }]), 'snark')).toEqual({ error: 'None of the prompts in “Bad” could be used.' });
  });

  it('keeps a Big Board within the phone\'s 1–8 × 1–10 and even', () => {
    const tall = { name: 'Tall', clues: Array.from({ length: 12 }, (_, i) => ({ clue: `Clue ${i}`, answer: `A${i}` })) };
    const short = { name: 'Short', clues: [{ clue: 'Only one', answer: 'One' }] };
    const r = readFile(file('quiz', [{ id: 'b', name: 'B', blurb: '', categories: [tall, short] }]), 'quiz');
    if ('error' in r) throw new Error(r.error);
    const [b] = r.packs as { categories: { clues: unknown[] }[] }[];
    expect(b.categories.map((c) => c.clues.length)).toEqual([10, 10]);
    expect(r.skipped).toBe(2);
  });
});

describe('a pack id freed for an import', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('picks the first free id', () => {
    const taken = new Set(['trip', 'trip-2']);
    expect(freshId('beach', (x) => taken.has(x))).toBe('beach');
    expect(freshId('trip', (x) => taken.has(x))).toBe('trip-3');
  });

  it('never overwrites a pack already on the phone or a built-in', () => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) });
    const builtin = wordDecks().find((d) => customDecks.isBuiltin(d.id))!;
    customDecks.put({ ...(SAMPLES.forehead as typeof builtin), name: 'Mine already' });
    const r = importPacks('forehead', exportFile('forehead', [SAMPLES.forehead, builtin]));
    if ('error' in r) throw new Error(r.error);
    expect(r.saved.map((p) => p.id)).toEqual(['our-trip-2', `${builtin.id}-2`]);
    // The copy of a built-in also gets a name of its own, so the two tiles can be told apart.
    expect(customDecks.all().map((d) => [d.id, d.name])).toEqual([['our-trip-2', 'Our Trip'], [`${builtin.id}-2`, `${builtin.name} (2)`], ['our-trip', 'Mine already']]);
    expect(customDecks.isEdited(builtin.id)).toBe(false);
    expect(importMessage('forehead', r)).toBe(`Imported 2 packs: Our Trip, ${builtin.name} (2).`);
    expect(importMessage('forehead', { ...r, skipped: 1 })).toBe(`Imported 2 packs: Our Trip, ${builtin.name} (2). 1 word skipped.`);
  });
});

describe('a pack name freed for an import', () => {
  it('numbers a name already in use, whatever its case', () => {
    const taken = new Set(['movies', 'movies (2)']);
    expect(freshName('Beach', (x) => taken.has(x))).toBe('Beach');
    expect(freshName('Movies', (x) => taken.has(x))).toBe('Movies (3)');
  });
});
