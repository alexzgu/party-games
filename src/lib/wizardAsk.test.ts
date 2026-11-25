import { afterEach, describe, expect, it, vi } from 'vitest';
import { settings } from './settings.svelte';
import { fakeStream } from './testing';
import { askedFor, BLURB_MAX, cleanName, cleanRequest, liftName, NAME_MAX, nameFrom, nameIn, REQUEST_MAX, wizardBlurb } from './wizardAsk';
import { PackName } from './packName.svelte';
import { generateItems } from './listWizard';
import { WIZARD } from '../games/brawl/generate';
import { generateWords } from '../games/forehead/generate';
import { generatePairs } from '../games/dial/generate';
import { fallbackCategory, generateCards as gibberishCards } from '../games/gibberish/generate';
import { generatePrompts } from '../games/quick/generate';
import { generateItems as snarkItems } from '../games/snark/generate';
import { generateCards as tabooCards } from '../games/taboo/generate';
import { checkPublish, LIBRARY } from '../../worker/src/library';

const LONG = "French pastries you'd find in a Paris bakery, nothing too obscure, mostly sweet ones like croissants and eclairs but a few savoury ones too, things a group of friends would know from a weekend trip or a bakery back home, and please no brand names or anything only a pastry chef would know about";

describe('the request', () => {
  it('is carried whole, up to its limit', () => {
    expect(LONG.length).toBeLessThanOrEqual(REQUEST_MAX);
    expect(askedFor(LONG, 'x')).toBe(`The player asks for: ${LONG}`);
    expect(askedFor('  ', 'a mix of everything')).toBe('The player asks for: a mix of everything');
    expect(cleanRequest('a'.repeat(REQUEST_MAX + 50))).toHaveLength(REQUEST_MAX);
  });
});

describe("Fizzwick's name line", () => {
  /** The lines `liftName` hands to the item parser, and the names it lifts, for one reply. */
  function lift(reply: string[]) {
    const lines: string[] = [];
    const names: string[] = [];
    reply.forEach(liftName((l) => lines.push(l), (n) => names.push(n)));
    return { lines, names };
  }

  it('is only the first line, with a colon and a good name, and is never handed over as an item', () => {
    expect(lift(['**Name:** Paris Bakery', 'Croissant', 'Name: Second Try', 'Pain au Chocolat'])).toEqual({ names: ['Paris Bakery'], lines: ['Croissant', 'Name: Second Try', 'Pain au Chocolat'] });
    expect(lift(['Pack name：Sweet Stuff', 'Eclair'])).toEqual({ names: ['Sweet Stuff'], lines: ['Eclair'] });
    // A dash is never a name marker (this pinned the old, wrong behaviour as 'Sweet Stuff').
    expect(nameIn('- Pack name - Sweet Stuff')).toBeNull();
    expect(nameIn('Nameless Ghost')).toBeNull();
  });

  it('never swallows a real item that looks like a name line', () => {
    expect(lift(['Name-Dropping', 'Croissant'])).toEqual({ names: [], lines: ['Name-Dropping', 'Croissant'] });
    expect(lift(['Name-Brand Snacks | 1 | This cereal mascot is a tiger. | Tony', 'Name-Brand Snacks | 2 | A clue. | An answer'])).toEqual({
      names: [], lines: ['Name-Brand Snacks | 1 | This cereal mascot is a tiger. | Tony', 'Name-Brand Snacks | 2 | A clue. | An answer'],
    });
    // Not a good name (a list of five): the first line goes to the parser untouched.
    expect(lift(['Name: Label, Tag, Title, Call, Identity'])).toEqual({ names: [], lines: ['Name: Label, Tag, Title, Call, Identity'] });
    // Only the first line can be the name: after a preamble, a name-like line is an item.
    expect(lift(['Here you go:', 'Name: Late Name'])).toEqual({ names: [], lines: ['Here you go:', 'Name: Late Name'] });
  });

  it('is tidied to Title Case, and refused when empty, too long or not words', () => {
    expect(cleanName('"paris bakery treats."')).toBe('Paris Bakery Treats');
    expect(cleanName('out of this world')).toBe('Out of This World');
    expect(cleanName('one two three four five')).toBeNull();
    expect(cleanName('Supercalifragilisticexpialidocious Pastries')).toBeNull();
    expect(cleanName('')).toBeNull();
    expect(cleanName('123 !!')).toBeNull();
    expect(cleanName('Label, Tag, Call')).toBeNull();
  });

  it("falls back to the request's first few words", () => {
    expect(nameFrom(LONG, 'Wizard pack')).toBe('French Pastries');
    expect(nameFrom('Make me a pack about 90s cartoons', 'x')).toBe('90s Cartoons');
    expect(nameFrom('I want words about the office (the US one)', 'x')).toBe('The Office');
    expect(nameFrom('Board games', 'x')).toBe('Board Games');
    expect(nameFrom('things at a wedding', 'x')).toBe('Things at a Wedding');
    expect(nameFrom('Taylor Swift songs from her early albums', 'x')).toBe('Taylor Swift Songs');
    expect(nameFrom('   ', 'Wizard pack')).toBe('Wizard pack');
    expect(nameFrom('a'.repeat(80), 'x').length).toBeLessThanOrEqual(NAME_MAX);
  });
});

describe('the name on the review screen', () => {
  it("shows the request's first words, takes Fizzwick's name, and never overwrites one the player typed", () => {
    const n = new PackName();
    n.begin('wizard', 'board games for game night', 'My pack');
    expect(n.value).toBe('Board Games');
    expect(n.wanted).toBe(true);
    n.suggest('one two three four five'); // a bad name: the stand-in stays, and the next run asks again
    expect(n.value).toBe('Board Games');
    expect(n.wanted).toBe(true);
    n.suggest('Game Night Classics');
    expect(n.value).toBe('Game Night Classics');
    expect(n.wanted).toBe(false);
    n.type('Our Game Night');
    n.begin('wizard', 'board games for game night', 'My pack'); // "More"
    n.suggest('Something Else');
    expect(n.value).toBe('Our Game Night');
    n.reset(); // back to the request: a typed name stays
    expect(n.value).toBe('Our Game Night');
    expect(n.saved('board games', 'My pack')).toBe('Our Game Night');
  });

  it('forgets an untyped name on going back, and saves the stand-in when the field is emptied', () => {
    const n = new PackName();
    n.suggest('Game Night Classics');
    n.reset();
    expect(n.value).toBe('');
    expect(n.wanted).toBe(true);
    n.type('  ');
    expect(n.saved('board games', 'My pack')).toBe('Board Games');
  });

  it('keeps a typed name only for the pack it was typed for', () => {
    const n = new PackName();
    n.begin('paste', '', '');
    expect(n.value).toBe(''); // a pasted list's field starts on its placeholder
    n.type('Our Pasted List');
    n.begin('wizard', 'board games', 'My pack'); // back, then the wizard: another pack
    expect(n.value).toBe('Board Games');
    expect(n.wanted).toBe(true);
    n.type('Game Night');
    n.begin('wizard', ' board games ', 'My pack'); // "Try again", the same request
    expect(n.value).toBe('Game Night');
    expect(n.wanted).toBe(false);
    n.begin('wizard', 'card games', 'My pack'); // other words: another pack
    expect(n.value).toBe('Card Games');
    expect(n.wanted).toBe(true);
    n.begin('wizard', '', 'My pack'); // a review with no request still starts with a name
    expect(n.value).toBe('My pack');
  });
});

describe('the description', () => {
  it('keeps "Conjured by Fizzwick" with the request cut at a whole word, inside every limit', () => {
    const b = wizardBlurb(LONG);
    expect(b.length).toBeLessThanOrEqual(BLURB_MAX);
    expect(b).toBe("Conjured by Fizzwick: French pastries you'd find in a Paris bakery, nothing too…");
    expect(wizardBlurb('Disney villains')).toBe('Conjured by Fizzwick: Disney villains');
    expect(wizardBlurb('')).toBe('Conjured by Fizzwick');
    const name = nameFrom(LONG, 'x');
    const shared = checkPublish(JSON.stringify({ game: 'forehead', name, blurb: b, localId: 'my-pastries', items: ['Croissant'], extra: { emoji: '✨' } }));
    expect(shared.ok).toBe(true);
    expect(BLURB_MAX).toBeLessThanOrEqual(LIBRARY.blurbMax);
    expect(NAME_MAX).toBeLessThanOrEqual(LIBRARY.nameMax);
  });
});

describe('a wizard run end to end', () => {
  afterEach(() => { vi.unstubAllGlobals(); settings.apiKey = ''; });

  function answer(text: string) {
    settings.apiKey = 'sk-test';
    const sent: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)).messages[0].content);
      return fakeStream(text);
    }));
    return sent;
  }

  it('asks for a name only when one is wanted, and the name line never becomes an item', async () => {
    // "Name：Paris Bakery" (a wide colon) passes Heads Down.'s word rules, so only the lifter keeps it out.
    const sent = answer('Name：Paris Bakery\nCroissant\nName-Dropping\nEclair\n');
    const words: string[] = [];
    const names: string[] = [];
    await generateWords({ theme: LONG, count: 10, avoid: [], onItem: (w) => words.push(w), onName: (n) => names.push(n), signal: new AbortController().signal });
    expect(sent[0]).toContain(`The player asks for: ${LONG}`);
    expect(sent[0]).toMatch(/"Name: "/);
    expect(sent[0]).toMatch(/only exception to the output rules/);
    expect(names).toEqual(['Paris Bakery']);
    expect(words).toEqual(['Croissant', 'Name-Dropping', 'Eclair']);
    await generateWords({ theme: LONG, count: 10, avoid: [], onItem: () => {}, signal: new AbortController().signal });
    expect(sent[1]).not.toMatch(/"Name: "/);
  });

  it('works the same for the list games', async () => {
    answer('Name: Office Brawlers\nTitle: Reply-all champion of the world\nWorst at muting on calls\n');
    const got: string[] = [];
    let name = '';
    await generateItems(WIZARD, { theme: 'office life', count: 5, avoid: [], onItem: (i) => got.push(i.text), onName: (n) => (name = n) });
    expect(name).toBe('Office Brawlers');
    expect(got).toEqual(['Reply-all champion of the world', 'Worst at muting on calls']);
  });

  it('works the same for Spectrum, Inn Co Hear Ant, Brain Freeze and Snark Tank', async () => {
    const names: string[] = [];
    const onName = (n: string) => names.push(n);
    const sent = answer('Name: Hot Takes\nCold | Hot\n');
    const pairs: string[] = [];
    await generatePairs({ theme: 'temperature', avoid: [], onPair: (c) => pairs.push(`${c.left}|${c.right}`), onName });
    expect(pairs).toEqual(['Cold|Hot']);
    answer('Name: Art Class\nMoan A Lease Ah | Mona Lisa | Painting\n');
    const cards: string[] = [];
    await gibberishCards({ theme: 'art', existing: [], onCard: (c) => cards.push(c.answer), onName });
    expect(cards).toEqual(['Mona Lisa']);
    answer('Name: Fridge Raid\nthings you put on a hot dog\n');
    const prompts: string[] = [];
    await generatePrompts({ theme: 'food', existing: [], onPrompt: (p) => prompts.push(p), onName });
    expect(prompts).toEqual(['things you put on a hot dog']);
    answer('Name: Boat Names\nA terrible name for a yacht | The Unsinkable III\n');
    const quips: string[] = [];
    await snarkItems({ theme: 'boats', count: 5, avoid: [], onItem: (i) => quips.push(i.prompt), onName });
    expect(quips).toEqual(['A terrible name for a yacht']);
    expect(names).toEqual(['Hot Takes', 'Art Class', 'Fridge Raid', 'Boat Names']);
    expect(sent[0]).toMatch(/"Name: "/);
  });

  it("hands a Don't Say It card for the word Name to the parser, and names the pack only from a good first line", async () => {
    answer('Name: Label, Tag, Title, Call, Identity\nPizza: Cheese, Slice, Pepperoni, Italian, Delivery\n');
    const words: string[] = [];
    const names: string[] = [];
    await tabooCards({ theme: 'nouns', count: 5, avoid: [], onCard: (c) => words.push(c.word), onName: (n) => names.push(n) });
    expect(words).toEqual(['Name', 'Pizza']);
    expect(names).toEqual([]);
    answer('Name: Pizza Night\nPizza: Cheese, Slice, Pepperoni, Italian, Delivery\n');
    await tabooCards({ theme: 'pizza', count: 5, avoid: [], onCard: () => {}, onName: (n) => names.push(n) });
    expect(names).toEqual(['Pizza Night']);
  });
});

describe("Inn Co Hear Ant's category for a card that comes without one", () => {
  it('is a short request in Title Case, else none', () => {
    expect(fallbackCategory('2000s throwback')).toBe('2000s Throwback');
    expect(fallbackCategory(' movies ')).toBe('Movies');
    expect(fallbackCategory('famous 90s movies and the stars in them')).toBe('');
    expect(fallbackCategory('Supercalifragilistic expialidocious')).toBe('');
  });
});
