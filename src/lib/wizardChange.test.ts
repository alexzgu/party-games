import { afterEach, describe, expect, it, vi } from 'vitest';
import { settings } from './settings.svelte';
import { fakeStream } from './testing';
import { changeTurns, quota, resultLine, tally, type ChangeGame } from './wizardChange';
import { NOTHING_BACK, WizardChanges } from './wizardChanges.svelte';
import { PackName } from './packName.svelte';
import { NAME_ASK } from './wizardAsk';
import { changeGame, type ListWizard } from './listWizard';
import type { ListItem } from './listPack';
import { CHANGE as FOREHEAD } from '../games/forehead/generate';
import { CHANGE as DIAL } from '../games/dial/generate';
import { CHANGE as GIBBERISH } from '../games/gibberish/generate';
import { CHANGE as QUICK } from '../games/quick/generate';
import { CHANGE as TABOO } from '../games/taboo/generate';
import { CHANGE as SNARK, finalsFor } from '../games/snark/generate';
import type { SnarkItem } from '../games/snark/pack';
import { MAKE_RANGE as BRAWL_RANGE, WIZARD as BRAWL } from '../games/brawl/generate';
import { MAKE_RANGE as HAND_RANGE, WIZARD as HAND } from '../games/hand/generate';
import { MAKE_RANGE as SKETCH_RANGE, WIZARD as SKETCH } from '../games/sketch/generate';
import { MAKE_RANGE as RATHER_RANGE, WIZARD as RATHER } from '../games/rather/generate';
import { MAKE_RANGE as TRIVIA_RANGE, WIZARD as TRIVIA } from '../games/trivia/generate';

/** `read(line(item))` gives every item back. */
function roundTrip<T, A>(g: ChangeGame<T, A>, items: T[], request = '') {
  for (const t of items) expect(g.read(g.line(t), request)).toEqual(t);
}
const list = (w: ListWizard, range: { max: number }) => changeGame(w, range.max);

describe('each game writes its list back in the format it reads', () => {
  it('Heads Down., Spectrum, Inn Co Hear Ant, Brain Freeze, Don\'t Say It, Snark Tank', () => {
    roundTrip(FOREHEAD, ['Croissant', 'Pain au Chocolat', 'Name-Dropping', "Rock 'n' Roll"]);
    roundTrip(DIAL, [{ left: 'Cold', right: 'Hot' }, { left: 'Underrated', right: 'Overrated' }]);
    roundTrip(GIBBERISH, [{ phrase: 'Moan A Lease Ah', answer: 'Mona Lisa', hint: 'Painting' }, { phrase: 'Hair Eye Pot Her', answer: 'Harry Potter', hint: '' }]);
    roundTrip(QUICK, ["things you'd find in a fridge", 'songs by Taylor Swift']);
    roundTrip(TABOO, [{ word: 'Road trip', banned: ['Car', 'Highway', 'Snacks', 'Drive', 'Map'] }, { word: 'Name', banned: ['Label', 'Tag', 'Title', 'Call', 'Identity'] }]);
    roundTrip(SNARK, [
      { kind: 'prompt', prompt: 'A terrible name for a boat', safety: 'The Unsinkable II' },
      { kind: 'final', prompt: 'Three things you should never say to your landlord', house: ['I have a snake now', 'Define damage', 'Rent is a social construct'] },
    ] as SnarkItem[]);
  });

  it('Doodle Brawl, Bad Hand, Sketchy, Would You Rather, Smarty Pants', () => {
    const t = (field: string, text: string): ListItem => ({ field, text });
    roundTrip(list(BRAWL, BRAWL_RANGE), [t('titles', "World's okayest roommate")]);
    roundTrip(list(HAND, HAND_RANGE), [t('prompts', 'My RA wrote me up for ___'), t('prompts', 'What got me through finals?'), t('answers', 'A suspiciously large rice cooker')]);
    roundTrip(list(SKETCH, SKETCH_RANGE), [t('words', 'Lava lamp'), t('ideas', 'A cat filing its taxes')]);
    roundTrip(list(RATHER, RATHER_RANGE), [t('prompts', 'be able to fly or be invisible')]);
    roundTrip(list(TRIVIA, TRIVIA_RANGE), [t('questions', 'Science | What gas do plants take in from the air? | Carbon dioxide | Oxygen | Nitrogen | Helium')]);
  });
});

describe('how many a change asks for', () => {
  it('is what is kept, never fewer than first asked for and never more than one run may ask', () => {
    const words = (n: number) => Array.from({ length: n }, (_, i) => `Word ${i}`);
    expect(quota(FOREHEAD, words(35), 30)).toEqual({ counts: { all: 35 }, capped: false });
    expect(quota(FOREHEAD, words(12), 30)).toEqual({ counts: { all: 30 }, capped: false });
    expect(quota(FOREHEAD, words(95), 30)).toEqual({ counts: { all: 80 }, capped: true });
  });

  it('counts each list of a game with several', () => {
    const t = (field: string, i: number): ListItem => ({ field, text: `${field} ${i}` });
    const kept = [...Array.from({ length: 3 }, (_, i) => t('prompts', i)), ...Array.from({ length: 30 }, (_, i) => t('answers', i))];
    expect(quota(list(HAND, HAND_RANGE), kept, 5)).toEqual({ counts: { prompts: 5, answers: 30 }, capped: false });
    const snark = Array.from({ length: 8 }, (_, i) => ({ kind: 'prompt' as const, prompt: `Prompt number ${i} here`, safety: 'Yes' }));
    expect(quota(SNARK, snark, 30).counts).toEqual({ prompt: 30, final: finalsFor(30) });
  });
});

describe('the three messages of a change', () => {
  const base = {
    request: 'pastries', asked: 20, kept: ['Croissant', 'Eclair'], removed: ['Bagel'],
    earlier: ['one', 'two', 'three', 'four', 'five', 'six'], ask: 'only the ones from France', avoid: ['Pretzel'],
  };

  it('are the first prompt, the kept list as Fizzwick would write it, then the change', () => {
    const { turns, counts } = changeTurns(FOREHEAD, { ...base, named: false });
    expect(turns.map((t) => t.role)).toEqual(['user', 'assistant', 'user']);
    expect(turns[0].content).toBe(FOREHEAD.first('pastries', 20));
    expect(turns[0].content).not.toContain(NAME_ASK);
    expect(turns[1].content).toBe('Croissant\nEclair');
    expect(counts).toEqual({ all: 20 });
    const c = turns[2].content;
    expect(c).toMatch(/^The player asks for a change: only the ones from France/);
    expect(c).toContain('Changes already made, oldest first:\n- two\n- three\n- four\n- five\n- six');
    expect(c).not.toContain('- one');
    expect(c).toContain('never bring them back:\nBagel');
    expect(c).toContain('Write the whole list again: exactly 20 items');
    expect(c).toContain('never use them either:\nPretzel');
    expect(c).not.toContain(NAME_ASK);
  });

  it('ask for a name only when one is wanted, and never leave the assistant message empty', () => {
    const { turns } = changeTurns(FOREHEAD, { ...base, kept: [], earlier: [], named: true });
    expect(turns[2].content.endsWith(NAME_ASK)).toBe(true);
    expect(turns[1].content).not.toBe('');
    expect(turns[2].content).not.toContain('Changes already made');
  });
});

describe("Fizzwick's result line", () => {
  it('counts an item as kept when its key was on screen before', () => {
    const t = tally(['Croissant', 'Eclair', 'Bagel'], ['croissant', 'Madeleine', 'Eclair'], (s) => s.toLowerCase());
    expect(t).toEqual({ kept: 2, replaced: 1 });
    expect(resultLine(t, false)).toBe('Kept 2 · replaced 1');
    expect(resultLine(t, true)).toContain('3 came back');
  });
});

describe('asking for a change on a review', () => {
  afterEach(() => { vi.unstubAllGlobals(); settings.apiKey = ''; });

  /** A review screen's state, as a screen holds it. */
  function screen(items: string[], dropped: string[]) {
    const s = { items, dropped: new Set(dropped), name: new PackName() };
    s.name.begin('wizard', 'pastries', 'Wizard pack');
    s.name.suggest('Pastry Party');
    const changes = new WizardChanges({
      game: FOREHEAD, request: () => 'pastries', asked: () => 2, avoid: () => [],
      items: () => s.items, setItems: (v) => (s.items = v), dropped: () => s.dropped, setDropped: (v) => (s.dropped = v),
      name: () => s.name,
    });
    return { s, changes };
  }
  function reply(...answers: (string | number)[]) {
    settings.apiKey = 'sk-test';
    const bodies: { messages: { role: string; content: string }[] }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_u: unknown, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      const a = answers.shift();
      return typeof a === 'number' ? new Response('{}', { status: a, headers: { 'content-type': 'application/json' } }) : fakeStream(a ?? '');
    }));
    return bodies;
  }

  it('replaces the list, names it again, notes what changed, and Undo brings everything back', async () => {
    const { s, changes } = screen(['Croissant', 'Bagel', 'Eclair'], ['bagel']);
    const bodies = reply('Name: French Pastries\nCroissant\nMadeleine\nBagel\nEclair\n');
    await changes.ask('only the ones from France');
    expect(bodies[0].messages.map((m) => m.role)).toEqual(['user', 'assistant', 'user']);
    expect(bodies[0].messages[1].content).toBe('Croissant\nEclair');
    expect(bodies[0].messages[2].content).toContain(NAME_ASK);
    expect(s.items).toEqual(['Croissant', 'Madeleine']); // Bagel was removed; the count is the kept two
    expect(s.dropped.size).toBe(0);
    expect(s.name.value).toBe('French Pastries');
    expect(changes.thread).toEqual([{ ask: 'only the ones from France', result: 'Kept 1 · replaced 1' }]);
    changes.undo();
    expect(s.items).toEqual(['Croissant', 'Bagel', 'Eclair']);
    expect([...s.dropped]).toEqual(['bagel']);
    expect(s.name.value).toBe('Pastry Party');
    expect(changes.thread).toEqual([]);
    expect(changes.canUndo).toBe(false);
  });

  it('keeps a typed name and asks for none', async () => {
    const { s, changes } = screen(['Croissant', 'Eclair'], []);
    s.name.type('Our Bakery');
    const bodies = reply('Croissant\nMadeleine\n');
    await changes.ask('French ones');
    expect(bodies[0].messages[2].content).not.toContain(NAME_ASK);
    expect(s.name.value).toBe('Our Bakery');
  });

  it('puts the list back untouched when the change fails or brings nothing', async () => {
    const { s, changes } = screen(['Croissant', 'Bagel'], ['bagel']);
    reply(400, 'Sorry, I cannot help with that.\n'); // 400: the SDK does not retry it
    await changes.ask('only French');
    expect(s.items).toEqual(['Croissant', 'Bagel']);
    expect([...s.dropped]).toEqual(['bagel']);
    expect(s.name.value).toBe('Pastry Party');
    expect(changes.error).toBeTruthy(); // the request's own error line (Node has no navigator.onLine, so it reads "No internet")
    expect(changes.error).not.toBe(NOTHING_BACK);
    expect(changes.thread).toEqual([]);
    await changes.ask('only French');
    expect(s.items).toEqual(['Croissant', 'Bagel']);
    expect(changes.error).toBe(NOTHING_BACK);
    expect(changes.canUndo).toBe(false);
  });

  it('puts the list back when stopped', async () => {
    const { s, changes } = screen(['Croissant'], []);
    reply('Madeleine\n');
    const going = changes.ask('only French');
    changes.stop();
    await going;
    expect(s.items).toEqual(['Croissant']);
    expect(changes.thread).toEqual([]);
  });
});
