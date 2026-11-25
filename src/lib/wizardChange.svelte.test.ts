import { afterEach, describe, expect, it, vi } from 'vitest';
import { settings } from './settings.svelte';
import { render } from 'svelte/server';
import { fakeReplies, fakeStream, unfinishedStream } from './testing';
import TestScreen from './TestScreen.svelte';
import { changeTurns, parts, resultLine, tally, type ChangeGame } from './wizardChange';
import { MAX_REQUEST_BYTES } from './addMore';
import { streamLines } from './claude';
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
  const words = (n: number) => Array.from({ length: n }, (_, i) => `Word ${i}`);
  const counts = <T,>(ps: { counts: Record<string, number>; kept: T[] }[]) => ps.map((p) => p.counts);

  it('is what is kept, never fewer than first asked for', () => {
    expect(counts(parts(FOREHEAD, words(35), 30))).toEqual([{ all: 35 }]);
    expect(counts(parts(FOREHEAD, words(12), 30))).toEqual([{ all: 30 }]);
  });

  it('cuts a list longer than one run may ask for into parts, none above it, the total unchanged', () => {
    // Was one request capped at 80 ("capped: true"): the list then shrank.
    const ps = parts(FOREHEAD, words(95), 30);
    expect(counts(ps)).toEqual([{ all: 80 }, { all: 15 }]);
    expect(ps.flatMap((p) => p.kept)).toEqual(words(95));
  });

  it('cuts each list of a game with several on its own', () => {
    const t = (field: string, i: number): ListItem => ({ field, text: `${field} ${i}` });
    const kept = [...Array.from({ length: 3 }, (_, i) => t('prompts', i)), ...Array.from({ length: 30 }, (_, i) => t('answers', i))];
    expect(counts(parts(list(HAND, HAND_RANGE), kept, 5))).toEqual([{ prompts: 5, answers: 30 }]);
    const long = [...Array.from({ length: 12 }, (_, i) => t('prompts', i)), ...Array.from({ length: 200 }, (_, i) => t('answers', i))];
    const cap = HAND.split(HAND_RANGE.max);
    const ps = parts(list(HAND, HAND_RANGE), long, 5);
    expect(ps.length).toBeGreaterThan(1);
    for (const p of ps) for (const k of Object.keys(cap)) expect(p.counts[k]).toBeLessThanOrEqual(cap[k]);
    expect(ps.reduce((n, p) => n + p.counts.answers, 0)).toBe(200);
    expect(ps.reduce((n, p) => n + p.counts.prompts, 0)).toBe(12);
    const snark = Array.from({ length: 8 }, (_, i) => ({ kind: 'prompt' as const, prompt: `Prompt number ${i} here`, safety: 'Yes' }));
    expect(counts(parts(SNARK, snark, 30))).toEqual([{ prompt: 30, final: finalsFor(30) }]);
  });
});

describe('the three messages of a change', () => {
  const base = {
    request: 'pastries', asked: 20, kept: ['Croissant', 'Eclair'], removed: ['Bagel'],
    earlier: ['one', 'two', 'three', 'four', 'five', 'six'], ask: 'only the ones from France', avoid: ['Pretzel'],
  };

  it('are the first prompt, the kept list as Fizzwick would write it, then the change', () => {
    const o = { ...base, named: false };
    const [part] = parts(FOREHEAD, o.kept, o.asked);
    const turns = changeTurns(FOREHEAD, o, part);
    expect(turns.map((t) => t.role)).toEqual(['user', 'assistant', 'user']);
    expect(turns[0].content).toBe(FOREHEAD.first('pastries', 20));
    expect(turns[0].content).not.toContain(NAME_ASK);
    expect(turns[1].content).toBe('Croissant\nEclair');
    expect(part.counts).toEqual({ all: 20 });
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
    const o = { ...base, kept: [], earlier: [], named: true };
    const turns = changeTurns(FOREHEAD, o, parts(FOREHEAD, o.kept, o.asked)[0]);
    expect(turns[2].content.endsWith(NAME_ASK)).toBe(true);
    expect(turns[1].content).not.toBe('');
    expect(turns[2].content).not.toContain('Changes already made');
  });
});

describe("Fizzwick's result line", () => {
  it('counts an item as kept when its key was on screen before', () => {
    const t = tally(['Croissant', 'Eclair', 'Bagel'], ['croissant', 'Madeleine', 'Eclair'], (s) => s.toLowerCase());
    expect(t).toEqual({ kept: 2, replaced: 1 });
    expect(resultLine(t)).toBe('Kept 2 · replaced 1');
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
      game: FOREHEAD, request: () => 'pastries', asked: () => 2, avoid: () => [], running: () => false,
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

describe('a change never loses what is on screen', () => {
  afterEach(() => { vi.unstubAllGlobals(); settings.apiKey = ''; });

  /** A Heads Down. review: `words` with `dropped` marked, named "Pastry Party" by Fizzwick. */
  function review(words: string[], dropped: string[] = [], game: ChangeGame<string> = FOREHEAD) {
    settings.apiKey = 'sk-test';
    const s = { items: words, dropped: new Set(dropped), name: new PackName(), ticks: 0, running: false };
    s.name.begin('wizard', 'pastries', 'Wizard pack');
    s.name.suggest('Pastry Party');
    const make = () => new WizardChanges({
      game, request: () => 'pastries', asked: () => 2, avoid: () => [], running: () => s.running,
      items: () => s.items, setItems: (v) => (s.items = v), dropped: () => s.dropped, setDropped: (v) => (s.dropped = v),
      name: () => s.name, onItem: () => s.ticks++,
    });
    return { s, make };
  }
  const hang = (text: string) => (init: RequestInit) => unfinishedStream(text, 'hang', init.signal);

  it('puts back the list, its marks and its name when the reply breaks off after some items', async () => {
    const { s, make } = review(['Croissant', 'Bagel', 'Eclair'], ['bagel']);
    const changes = make();
    fakeReplies(vi.stubGlobal, () => unfinishedStream('Name: French Pastries\nMadeleine\nCroissant\n', 'break'));
    await changes.ask('only French');
    expect(s.items).toEqual(['Croissant', 'Bagel', 'Eclair']);
    expect([...s.dropped]).toEqual(['bagel']);
    expect(s.name.value).toBe('Pastry Party');
    expect(s.name.wanted).toBe(false);
    expect(changes.error).toBeTruthy();
    expect(changes.thread).toEqual([]);
  });

  it('puts everything back when stopped mid-reply, and nobody can type the name or start another run meanwhile', async () => {
    const { s, make } = review(['Croissant', 'Bagel'], ['bagel']);
    const changes = make();
    const seen = fakeReplies(vi.stubGlobal, hang('Name: French Pastries\nMadeleine\nCroissant\n'));
    const going = changes.ask('only French');
    await vi.waitFor(() => expect(s.items).toEqual(['Madeleine', 'Croissant']));
    expect(changes.writing).toBe(true);
    expect(s.name.locked).toBe(true);
    s.name.type('Mine');
    expect(s.name.value).not.toBe('Mine');
    await changes.ask('something else'); // refused: a change is writing
    expect(seen.bodies).toHaveLength(1);
    changes.stop();
    await going;
    expect(s.items).toEqual(['Croissant', 'Bagel']);
    expect([...s.dropped]).toEqual(['bagel']);
    expect(s.name.value).toBe('Pastry Party');
    expect(s.name.locked).toBe(false);
    expect(changes.thread).toEqual([]);
  });

  it("waits while the screen's own run writes", async () => {
    const { s, make } = review(['Croissant']);
    const changes = make();
    const seen = fakeReplies(vi.stubGlobal, 'Madeleine\n');
    s.running = true;
    expect(changes.writing).toBe(true);
    await changes.ask('only French');
    expect(seen.bodies).toHaveLength(0);
    expect(s.items).toEqual(['Croissant']);
  });

  it('stops when the screen is left: the request ends and nothing lands', async () => {
    const { s, make } = review(['Croissant', 'Eclair']);
    const seen = fakeReplies(vi.stubGlobal, hang('Madeleine\n'));
    let going: Promise<void> = Promise.resolve();
    // The screen makes its changes, a change starts, and the screen goes.
    void render(TestScreen, { props: { start: () => { going = make().ask('only French'); } } }).body; // reading it renders
    expect(s.items).toEqual([]); // the change had started
    await going;
    expect(seen.signals.every((sig) => sig?.aborted)).toBe(true);
    expect(s.ticks).toBe(0);
    expect(s.items).toEqual(['Croissant', 'Eclair']);
  });

  it('keeps a name typed after a change through Undo, and the name says truly whether it was typed', async () => {
    const { s, make } = review(['Croissant', 'Bagel']);
    const changes = make();
    fakeReplies(vi.stubGlobal, 'Name: French Pastries\nCroissant\nMadeleine\n');
    await changes.ask('only French');
    expect(s.name.value).toBe('French Pastries');
    s.name.type('Our Bakery');
    changes.undo();
    expect(s.items).toEqual(['Croissant', 'Bagel']);
    expect(s.name.value).toBe('Our Bakery');
    expect(s.name.wanted).toBe(false);
  });

  it('offers Undo only while nothing was changed by hand since the change', async () => {
    const { s, make } = review(['Croissant', 'Bagel']);
    const changes = make();
    fakeReplies(vi.stubGlobal, 'Croissant\nMadeleine\n');
    await changes.ask('only French');
    expect(changes.canUndo).toBe(true);
    s.dropped = new Set(['madeleine']);
    expect(changes.canUndo).toBe(false);
    changes.undo();
    expect(s.items).toEqual(['Croissant', 'Madeleine']);
    expect(changes.thread).toHaveLength(1);
  });

  it('changes a list 2.5 times what one run may ask for in three requests, none above it, and keeps its size', async () => {
    const small = { ...FOREHEAD, max: 4 };
    const words = Array.from({ length: 10 }, (_, i) => `Word ${i}`);
    const { s, make } = review(words, [], small);
    const changes = make();
    const reply = (from: number, n: number) => Array.from({ length: n }, (_, i) => `New ${from + i}`).join('\n') + '\n';
    const seen = fakeReplies(vi.stubGlobal, reply(0, 4), reply(4, 4), reply(8, 2));
    await changes.ask('make them new');
    expect(seen.bodies).toHaveLength(3);
    expect(seen.bodies.map((b) => b.messages[1].content.split('\n').length)).toEqual([4, 4, 2]);
    expect(seen.bodies.map((b) => /exactly (\d+) items/.exec(b.messages[2].content)?.[1])).toEqual(['4', '4', '2']);
    expect(seen.bodies[2].messages[2].content).toContain('Already written in this change, so never repeat them:\nNew 0');
    expect(s.items).toHaveLength(10);
    expect(changes.thread[0].result).toBe('Kept 0 · replaced 10');
  });

  it('puts the whole list back when a later request of a long change fails', async () => {
    const small = { ...FOREHEAD, max: 4 };
    const words = Array.from({ length: 10 }, (_, i) => `Word ${i}`);
    const { s, make } = review(words, ['word 9'], small);
    const changes = make();
    fakeReplies(vi.stubGlobal, 'New 0\nNew 1\nNew 2\nNew 3\n', 400);
    await changes.ask('make them new');
    expect(s.items).toEqual(words);
    expect([...s.dropped]).toEqual(['word 9']);
    expect(changes.thread).toEqual([]);
  });

  it('keeps every request under the body budget, however long the lists around it', () => {
    const long = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p} ${i} 🎉 ${'x'.repeat(60)}`);
    const o = { request: 'pastries', asked: 80, kept: long('Kept', 80), removed: long('Gone', 2000), earlier: [], ask: 'French ones', avoid: long('Used', 5000), named: true };
    const turns = changeTurns(FOREHEAD, o, parts(FOREHEAD, o.kept, o.asked)[0]);
    const body = new TextEncoder().encode(JSON.stringify({ model: 'claude-opus-5-5', max_tokens: 4000, system: FOREHEAD.system, messages: turns })).length;
    expect(body).toBeLessThanOrEqual(MAX_REQUEST_BYTES);
    expect(turns[2].content).toContain('never bring them back');
  });

  it('sends a change typed over several lines as one line', async () => {
    const { make } = review(['Croissant']);
    const changes = make();
    const seen = fakeReplies(vi.stubGlobal, 'Madeleine\n', 'Eclair\n');
    await changes.ask('only\nFrench\n ones');
    await changes.ask('sweeter');
    expect(changes.thread[0].ask).toBe('only French ones');
    expect(seen.bodies[1].messages[2].content).toContain('Changes already made, oldest first:\n- only French ones');
  });
});

describe('a reply cut off by the token limit', () => {
  afterEach(() => { vi.unstubAllGlobals(); settings.apiKey = ''; });

  it('never hands over its unfinished last line', async () => {
    settings.apiKey = 'sk-test';
    fakeReplies(vi.stubGlobal, (() => fakeStream('Alpha\nBeta\nGam', 'max_tokens')), 'Alpha\nBeta\nGamma');
    const cut: string[] = [];
    await streamLines({ system: 's', prompt: 'p', onLine: (l) => cut.push(l) });
    expect(cut).toEqual(['Alpha', 'Beta']);
    const whole: string[] = [];
    await streamLines({ system: 's', prompt: 'p', onLine: (l) => whole.push(l) });
    expect(whole).toEqual(['Alpha', 'Beta', 'Gamma']);
  });
});
