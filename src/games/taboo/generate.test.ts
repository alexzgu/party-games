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

const { buildPrompt, generateCards, moreCards, readCard, SYSTEM } = await import('./generate');

describe('Don\'t Say It wizard', () => {
  it('asks for the theme and size, with the quality bar and every word already taken', () => {
    const p = buildPrompt(' camping ', 30, ['Tent', 'Campfire']);
    expect(p).toContain('The player asks for: camping');
    expect(p).toContain('Write 30 cards');
    expect(p).toMatch(/never use them again:\nTent\nCampfire$/);
    expect(SYSTEM).toMatch(/Exactly 5 banned words/);
    expect(SYSTEM).toMatch(/contains the word or sits inside it/);
    expect(SYSTEM).toMatch(/most of the room knows/);
  });

  it('reads a card line and drops any card the editor would refuse', () => {
    expect(readCard('1. **Road trip**: Car, Highway, Snacks, Drive, Map.')).toEqual({ word: 'Road trip', banned: ['Car', 'Highway', 'Snacks', 'Drive', 'Map'] });
    expect(readCard('Pizza: Pizzas, Cheese, Slice, Italian, Delivery')).toBeNull(); // banned word contains the word
    expect(readCard('Carpet: Car, Floor, Rug, Vacuum, Living room')).toBeNull(); // banned word sits inside it
    expect(readCard('Beach: Sand, Ocean, Waves, Towel')).toBeNull(); // four banned words
    expect(readCard('Beach: Sand, Sand, Waves, Towel, Sun')).toBeNull(); // a repeat
    expect(readCard('Here are your cards:')).toBeNull();
  });

  it('streams only valid cards with words new to the phone, up to the count', async () => {
    reply = [
      'Tent: Camping, Sleep, Outdoors, Zip, Poles',
      'Pizza: Pizzas, Cheese, Slice, Italian, Delivery',
      'Campfire: Flames, Logs, Smores, Smoke, Marshmallow',
      'Sleeping bag: Sleep, Warm, Zip, Tent, Night', // "Sleep" sits inside the word
      'campfire: Wood, Logs, Ghost stories, Burn, Night', // a repeat
      'Hiking: Trail, Boots, Walk, Mountain, Backpack',
      'Canoe: Paddle, Lake, Boat, Row, Tip',
    ];
    const got: string[] = [];
    const n = await generateCards({ theme: 'camping', count: 3, avoid: ['TENT'], onCard: (c) => got.push(c.word) });
    expect(got).toEqual(['Campfire', 'Hiking', 'Canoe']);
    expect(n).toBe(3);
  });

  it('"Add more" never repeats a word of this pack, of other packs or already on screen', async () => {
    reply = ['Tent: Camping, Sleep, Outdoors, Zip, Poles', 'Lantern: Light, Dark, Battery, Glow, Night', 'Compass: North, Direction, Needle, Lost, Map', 'Canoe: Paddle, Lake, Boat, Row, Tip'];
    const pack = { id: 'my-camp', name: 'Camping', blurb: 'Conjured by Fizzwick: camping', cards: [{ word: 'Tent', banned: ['Camping', 'Sleep', 'Outdoors', 'Zip', 'Poles'] }] };
    const got: string[] = [];
    await moreCards(pack, ['Compass'], { count: 5, steer: '', avoid: [{ word: 'Lantern', banned: [] }], onItem: (c) => got.push(c.word) });
    const prompt = sent.at(-1)!.prompt;
    expect(prompt).toContain('Write 5 more cards');
    expect(prompt).toMatch(/Already in the pack \(their words\)[^\n]*\nLantern\nTent/);
    expect(prompt).toMatch(/other packs \(their words\)[^\n]*\nCompass/);
    expect(got).toEqual(['Canoe']);
  });
});
