// "Ask Claude" end to end without a key or the network: fetch is stubbed with a fake streamed
// answer, so this runs the real SDK stream, line splitting and board building.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { settings } from '../../lib/settings.svelte';
import { buildPrompt, generateBoard, givesAway, placeClue, emptyBoardFor, SYSTEM } from './generate';
import { fakeStream } from '../../lib/testing';

const ANSWER = [
  'Here is your board:',
  'Space | 1 | This planet is nicknamed the Red Planet. | Mars',
  'Snacks | 1 | Movie theaters sell it by the bucket, often buttered. | Popcorn',
  'Space | 2 | The first person to walk on the Moon did it in 1969. | Neil Armstrong',
  'Snacks | 2 | This snack is just Mars again. | Mars',
  'Snacks | 2 | This Italian flatbread snack is Pizza. | Pizza',
  'Snacks | 2 | Tortilla chips piled with melted cheese and toppings. | Nachos',
  'Extra | 1 | A third category nobody asked for. | Nope',
  'Space | 3 | Off the board. | Pluto',
].join('\n');

afterEach(() => { vi.unstubAllGlobals(); settings.apiKey = ''; });

describe('Ask Claude for a board', () => {
  it('fills the board live from a streamed answer, skipping repeats, giveaways and extras', async () => {
    settings.apiKey = 'sk-test';
    const calls: { url: string; body: { system: string; messages: { content: string }[] } }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return fakeStream(ANSWER);
    }));
    const seen: number[] = [];
    const board = await generateBoard({ topic: 'space and snacks', cats: 2, levels: 2, onBoard: (b) => seen.push(b.categories.flatMap((c) => c.clues).filter((k) => k.clue).length) });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/v1\/messages/);
    expect(calls[0].body.system).toBe(SYSTEM);
    expect(calls[0].body.messages[0].content).toContain('2 categories with 2 levels');
    expect(seen).toEqual([1, 2, 3, 4]);
    expect(board.name).toBe('Space and Snacks');
    expect(board.categories).toEqual([
      { name: 'Space', clues: [{ clue: 'This planet is nicknamed the Red Planet.', answer: 'Mars' }, { clue: 'The first person to walk on the Moon did it in 1969.', answer: 'Neil Armstrong' }] },
      { name: 'Snacks', clues: [{ clue: 'Movie theaters sell it by the bucket, often buttered.', answer: 'Popcorn' }, { clue: 'Tortilla chips piled with melted cheese and toppings.', answer: 'Nachos' }] },
    ]);
  });
  it("names the board with Fizzwick's suggestion, never as a clue, and keeps the long request out of the description", async () => {
    settings.apiKey = 'sk-test';
    const sent: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)).messages[0].content);
      return fakeStream(`Name: out of this world\n${ANSWER}`);
    }));
    const request = 'space and snacks for a crowd that loves sci-fi movies, '.repeat(5).trim();
    const names: string[] = [];
    const board = await generateBoard({ topic: request, cats: 2, levels: 2, onBoard: (b) => names.push(b.name) });
    expect(sent[0]).toContain(`The player asks for: ${request}`);
    expect(sent[0]).toMatch(/"Name: "/);
    expect(names[0]).toBe('Out of This World');
    expect(board.name).toBe('Out of This World');
    expect(board.categories.map((c) => c.name)).toEqual(['Space', 'Snacks']);
    expect(board.blurb.length).toBeLessThanOrEqual(80);
    expect(board.blurb).toMatch(/^Conjured by Fizzwick: space and snacks .*…$/);
  });
  it('keeps a category whose name starts with "Name-", and makes no sound for the name alone', async () => {
    settings.apiKey = 'sk-test';
    vi.stubGlobal('fetch', vi.fn(async () => fakeStream([
      'Name: Snack Attack',
      'Name-Brand Snacks | 1 | This cheese cracker is shaped like a small fish. | Goldfish',
      'Name-Brand Snacks | 2 | This sandwich cookie has a cream filling between two dark wafers. | Oreo',
    ].join('\n'))));
    const updates: boolean[] = [];
    const board = await generateBoard({ topic: 'snacks', cats: 1, levels: 2, onBoard: (_b, clue) => updates.push(clue) });
    expect(board.name).toBe('Snack Attack');
    expect(board.categories).toEqual([{ name: 'Name-Brand Snacks', clues: [
      { clue: 'This cheese cracker is shaped like a small fish.', answer: 'Goldfish' },
      { clue: 'This sandwich cookie has a cream filling between two dark wafers.', answer: 'Oreo' },
    ] }]);
    expect(updates).toEqual([false, true, true]);
  });
  it('says what went wrong without a key', async () => {
    await expect(generateBoard({ topic: 'x', cats: 1, levels: 1, onBoard: () => {} })).rejects.toThrow(/isn't on this phone yet/);
  });
});

describe('placing clues', () => {
  it('spots a clue that names its own answer', () => {
    expect(givesAway('Neil Armstrong was first on the Moon', 'Neil Armstrong')).toBe(true);
    expect(givesAway('A Disney mermaid', 'The Little Mermaid')).toBe(false);
    expect(givesAway('The first person on the Moon', 'Neil Armstrong')).toBe(false);
  });
  it('fills a tile once, and only inside the asked size', () => {
    let b = emptyBoardFor('t', 1, 2);
    b = placeClue(b, { category: 'A', level: 1, clue: 'c1', answer: 'a1' }, 1, 2);
    expect(placeClue(b, { category: 'A', level: 1, clue: 'c2', answer: 'a2' }, 1, 2)).toBe(b);
    expect(placeClue(b, { category: 'B', level: 2, clue: 'c3', answer: 'a3' }, 1, 2)).toBe(b);
    expect(placeClue(b, { category: 'A', level: 3, clue: 'c4', answer: 'a4' }, 1, 2)).toBe(b);
  });
  it('asks for the right size', () => {
    expect(buildPrompt('Cats', 1, 3)).toContain('1 category with 3 levels each: 3 lines');
  });
});
