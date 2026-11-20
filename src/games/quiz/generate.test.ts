// "Ask Claude" end to end without a key or the network: fetch is stubbed with a fake streamed
// answer, so this runs the real SDK stream, line splitting and board building.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { settings } from '../../lib/settings.svelte';
import { buildPrompt, generateBoard, givesAway, placeClue, emptyBoardFor, SYSTEM } from './generate';

/** A server-sent-events body like the Messages API streams, with `text` cut into small deltas. */
function fakeStream(text: string): Response {
  const ev = (type: string, data: object) => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
  const deltas = text.match(/[\s\S]{1,7}/g) ?? [];
  const body = [
    ev('message_start', { message: { id: 'msg_test', type: 'message', role: 'assistant', model: 'test', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 } } }),
    ev('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }),
    ...deltas.map((d) => ev('content_block_delta', { index: 0, delta: { type: 'text_delta', text: d } })),
    ev('content_block_stop', { index: 0 }),
    ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 50 } }),
    ev('message_stop', {}),
  ];
  const enc = new TextEncoder();
  const stream = new ReadableStream({ start(c) { for (const chunk of body) c.enqueue(enc.encode(chunk)); c.close(); } });
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

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
    expect(board.name).toBe('Space and snacks');
    expect(board.categories).toEqual([
      { name: 'Space', clues: [{ clue: 'This planet is nicknamed the Red Planet.', answer: 'Mars' }, { clue: 'The first person to walk on the Moon did it in 1969.', answer: 'Neil Armstrong' }] },
      { name: 'Snacks', clues: [{ clue: 'Movie theaters sell it by the bucket, often buttered.', answer: 'Popcorn' }, { clue: 'Tortilla chips piled with melted cheese and toppings.', answer: 'Nachos' }] },
    ]);
  });
  it('says what went wrong without a key', async () => {
    await expect(generateBoard({ topic: 'x', cats: 1, levels: 1, onBoard: () => {} })).rejects.toThrow(/invite link/);
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
