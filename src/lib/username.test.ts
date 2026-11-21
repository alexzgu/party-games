// A phone's username: given at random, tidied as typed, the Join screens' starting name.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanUsername, cutName, normaliseUsername, USERNAME_MAX } from './usernameShape';

let mem: Map<string, string>;
beforeEach(() => {
  mem = new Map();
  vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) });
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

/** A fresh copy of the module, as a newly opened page has it. */
const fresh = () => import('./username');

describe('username', () => {
  it('gives a new phone a random two-word name once, and keeps it', async () => {
    const u = await fresh();
    const name = u.getUsername();
    expect(name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    expect(u.getUsername()).toBe(name);
    expect(JSON.parse(mem.get('hr:username') ?? '""')).toBe(name);
    expect((await fresh()).getUsername()).toBe(name); // the next visit reads it back
  });

  it('replaces a stored name that is not a username', async () => {
    mem.set('hr:username', JSON.stringify('   '));
    expect((await fresh()).getUsername()).toMatch(/^\w+ \w+$/);
    mem.set('hr:username', JSON.stringify({ evil: 1 }));
    expect((await fresh()).getUsername()).toMatch(/^\w+ \w+$/);
  });

  it('saves what is typed, tidied, but never only spaces', async () => {
    const u = await fresh();
    expect(u.setUsername('  Big\t\u0007 Al  ')).toBe('Big Al');
    expect(u.getUsername()).toBe('Big Al');
    expect(u.setUsername('   ')).toBeNull();
    expect(u.getUsername()).toBe('Big Al');
    expect((await fresh()).getUsername()).toBe('Big Al');
    const next = u.freshUsername();
    expect(next).not.toBe('Big Al');
    expect(u.getUsername()).toBe(next);
  });

  it('makes names from friendly words that fit every room game (14 characters at most)', async () => {
    const { ADJECTIVES, ANIMALS, randomUsername } = await fresh();
    expect(new Set(ADJECTIVES).size).toBe(ADJECTIVES.length);
    expect(new Set(ANIMALS).size).toBe(ANIMALS.length);
    const longest = Math.max(...ADJECTIVES.map((a) => a.length)) + 1 + Math.max(...ANIMALS.map((a) => a.length));
    expect(longest).toBeLessThanOrEqual(14);
    expect(randomUsername(() => 0)).toBe(`${ADJECTIVES[0]} ${ANIMALS[0]}`);
    expect(randomUsername(() => 0.9999)).toBe(`${ADJECTIVES.at(-1)} ${ANIMALS.at(-1)}`);
  });

  it("starts a Join screen with the username cut to the game's limit, or with a refused join's name", async () => {
    const u = await fresh();
    u.setUsername('Captain Fluffy Whiskers');
    expect(u.joinName(14)).toBe('Captain Fluffy');
    expect(u.joinName(20)).toBe('Captain Fluffy Whisk');
    expect(u.joinName(14, 'Al')).toBe('Al');
    expect(u.joinName(14, '  ')).toBe('Captain Fluffy');
    expect(u.getUsername()).toBe('Captain Fluffy Whiskers'); // a join name never changes it
  });
});

describe('what a username may be', () => {
  it('collapses spaces and drops invisible characters, keeping joined emoji whole', () => {
    expect(normaliseUsername('  a \n\n b  ')).toBe('a b');
    expect(normaliseUsername('A‮b​c\u0000d­e')).toBe('Abcde');
    expect(normaliseUsername('Ziggy 👩‍🚀')).toBe('Ziggy 👩‍🚀');
    expect(normaliseUsername('​ \u0007')).toBe('');
  });

  it(`cuts typed text at ${USERNAME_MAX} characters, never inside an emoji`, () => {
    expect(normaliseUsername('x'.repeat(30))).toBe('x'.repeat(USERNAME_MAX));
    expect(cutName(`${'x'.repeat(23)}😀`, USERNAME_MAX)).toBe('x'.repeat(23));
    expect(cutName('Ab cd', 3)).toBe('Ab');
  });

  it(`takes 1 to ${USERNAME_MAX} characters once tidied, never cut, and only text`, () => {
    expect(cleanUsername(' Sneaky   Otter ')).toBe('Sneaky Otter');
    expect(cleanUsername('x'.repeat(USERNAME_MAX))).toBe('x'.repeat(USERNAME_MAX));
    expect(cleanUsername('x'.repeat(USERNAME_MAX + 1))).toBeNull();
    // Nothing visible (a lone joiner, variation selector or combining mark) is not a name; emoji and marks on letters are.
    for (const blank of ['\u200d', '\ufe0f', '\u0301', '\u200d\ufe0f', '\u2800', '\u3164', '\u2800\u3164']) {
      expect(cleanUsername(blank)).toBeNull();
      expect(normaliseUsername(blank)).toBe('');
    }
    expect(cleanUsername('👩‍🚀')).toBe('👩‍🚀');
    expect(cleanUsername('José')).toBe('José');
    expect(cleanUsername('Jose\u0301')).toBe('Jose\u0301');
    expect(cleanUsername('🇵🇷 ❤️')).toBe('🇵🇷 ❤️');
    expect(cleanUsername('می\u200cخواهم')).toBe('می\u200cخواهم');
    for (const bad of ['', '   ', '​', 7, null, undefined, ['Al'], { name: 'Al' }, 'x'.repeat(10_000)]) expect(cleanUsername(bad)).toBeNull();
  });
});
