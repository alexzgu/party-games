// The Community library's phone side without a browser: a fake fetch and a fake pass only.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settings } from './settings.svelte';
import { afterRun, canShare, failureWords, getPack, importLibraryPack, listPacks, namesIfImported, onLibraryNote, ownedIds, packPrint, passedSoFar, publishPack, SHARE_FAILED, shareByHand, shareProblem, shareStatus, shareStatusNow, shareWizardPack, starPack, type LibraryFull } from './library';
import { lastShared, noteShared } from './shareLog.svelte';
import { WIZARD_SERVER } from './wizardServer';
import { setUsername } from './username';
import { customDecks, customHand, customQuick, customQuiz, quizBoards, type HandPack, type QuickPack, type QuizBoard, type SnarkPack, type SpectrumPack, type WordDeck } from './content';
import { exportFile, importPacks } from './packfile';
import { addClues } from '../games/quiz/more';
import { tidyBoard } from '../games/quiz/board';
import { loadNewBoard, newBoardId, saveNewBoard } from '../games/quiz/store';

const PASS = 'fake.pass';
const KEY = 'sk-ant-test-not-a-real-key-000000';
const deck: WordDeck = { id: 'my-cartoons-abc', name: 'Cartoons', emoji: '📺', blurb: 'Conjured by Fizzwick: cartoons', words: ['Shrek', 'SpongeBob'], custom: true, added: '2026-11-20T10:00', shared: true };

function server(reply: () => Response = () => Response.json({ id: 'AAAAAAAAAAAA', created: true })) {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => reply());
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
  settings.apiKey = '';
  settings.wizardPass = '';
});

describe('sharing what the wizard made', () => {
  it('publishes the whole pack with the pass, without the fields only this phone uses', async () => {
    const fetch = server();
    settings.wizardPass = PASS;
    setUsername('Sneaky Otter');
    expect(await shareWizardPack('forehead', deck, true)).toBe(true);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${WIZARD_SERVER}/library/packs`);
    expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${PASS}`);
    expect(JSON.parse(String(init?.body))).toEqual({ game: 'forehead', name: 'Cartoons', blurb: 'Conjured by Fizzwick: cartoons', localId: 'my-cartoons-abc', items: ['Shrek', 'SpongeBob'], extra: { emoji: '📺' }, username: 'Sneaky Otter' });
  });

  it('shares nothing made without a pass, even once the phone has one, nor a built-in pack', async () => {
    const fetch = server();
    expect(await shareWizardPack('forehead', deck, true)).toBe(false); // no pass to send
    settings.wizardPass = PASS;
    expect(await shareWizardPack('forehead', deck, false)).toBe(false); // made with the host's key
    expect(await shareWizardPack('forehead', { ...deck, shared: undefined }, true)).toBe(false); // the pack is not marked
    expect(await shareWizardPack('forehead', { ...deck, id: 'movies' }, true)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('tells whether every run behind the items on screen went through a pass', () => {
    settings.wizardPass = PASS;
    expect(passedSoFar(false, 0)).toBe(true); // a fresh start through the pass
    expect(passedSoFar(true, 5)).toBe(true);
    expect(passedSoFar(false, 5)).toBe(false); // an earlier run on screen used the key
    settings.apiKey = KEY;
    expect(passedSoFar(true, 5)).toBe(false); // the key is what runs now
    expect(passedSoFar(true, 0)).toBe(false);
  });

  it("carries a Snark Tank pack's stock answers and finals", async () => {
    const fetch = server();
    settings.wizardPass = PASS;
    const finals = [{ prompt: 'Three things to never say on a boat', house: ['Iceberg', 'Oops', 'Swim?'] as [string, string, string] }];
    await shareWizardPack('snark', { id: 'my-boats', name: 'Boats', blurb: '', prompts: ['A bad name for a boat'], safety: { 'A bad name for a boat': 'Floaty' }, finals, shared: true }, true);
    expect(JSON.parse(String(fetch.mock.calls[0][1]?.body))).toMatchObject({ game: 'snark', items: ['A bad name for a boat'], extra: { safety: { 'A bad name for a boat': 'Floaty' }, finals } });
  });

  it('says so in a small note when sharing failed, and never throws', async () => {
    settings.wizardPass = PASS;
    const notes: string[] = [];
    const stop = onLibraryNote((n) => notes.push(n));
    server(() => new Response('nope', { status: 500 }));
    expect(await shareWizardPack('forehead', deck, true)).toBe(false);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect(await shareWizardPack('forehead', deck, true)).toBe(false);
    stop();
    expect(notes).toEqual([SHARE_FAILED, SHARE_FAILED]);
  });
});

describe('the share mark a pack keeps', () => {
  // Each step runs as the make pages and editors do: mark (afterRun), save, read back, share.
  beforeEach(() => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) });
  });
  const kept = <T extends { id: string }>(all: readonly T[], id: string): T => all.find((p) => p.id === id)!;
  const sentItems = (fetch: ReturnType<typeof server>) => JSON.parse(String(fetch.mock.calls[0][1]?.body)).items;

  function addMore(base: WordDeck, words: string[], byPass: boolean): WordDeck {
    customDecks.put(afterRun({ ...kept(customDecks.all(), base.id), words: [...words, ...base.words] }, byPass, false));
    return kept(customDecks.all(), base.id);
  }

  it('shares a pack made through a pass when a pass run adds to it, whole', async () => {
    const fetch = server();
    settings.wizardPass = PASS;
    customDecks.put(afterRun<WordDeck>({ id: 'my-pass-deck', name: 'Pass', emoji: '✨', blurb: '', words: ['Shrek'] }, true, true));
    const after = addMore(kept(customDecks.all(), 'my-pass-deck'), ['Pizza'], true);
    expect(await shareWizardPack('forehead', after, true)).toBe(true);
    expect(sentItems(fetch)).toEqual(['Pizza', 'Shrek']);
  });

  it("never shares a pack first made with the host's key, even when a pass run adds to it", async () => {
    const fetch = server();
    settings.wizardPass = PASS;
    customDecks.put(afterRun<WordDeck>({ id: 'my-key-deck', name: 'Key', emoji: '✨', blurb: '', words: ['Private'] }, false, true));
    const after = addMore(kept(customDecks.all(), 'my-key-deck'), ['Pizza'], true);
    expect(after.shared).toBeUndefined();
    expect(await shareWizardPack('forehead', after, true)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('drops the mark for good once a run on the key adds to the pack', async () => {
    const fetch = server();
    settings.wizardPass = PASS;
    customDecks.put(afterRun<WordDeck>({ id: 'my-mixed-deck', name: 'Mixed', emoji: '✨', blurb: '', words: ['Shrek'] }, true, true));
    addMore(kept(customDecks.all(), 'my-mixed-deck'), ['Private'], false);
    const after = addMore(kept(customDecks.all(), 'my-mixed-deck'), ['Pizza'], true);
    expect(await shareWizardPack('forehead', after, true)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('never shares a pasted Brain Freeze pack when a pass run is merged into it', async () => {
    const fetch = server();
    settings.wizardPass = PASS;
    // Pasted: the make page marks it only for a wizard run through a pass.
    customQuick.put(afterRun<QuickPack>({ id: 'my-pasted', name: 'Pasted', blurb: 'Pasted list', prompts: ['private things'] }, false, true));
    const dest = kept(customQuick.all(), 'my-pasted');
    customQuick.put(afterRun({ ...dest, prompts: [...dest.prompts, 'things in a dorm room'] }, true, false));
    expect(await shareWizardPack('quick', kept(customQuick.all(), 'my-pasted'), true)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  /** A Big Board drafted by the wizard (through a pass or not), saved, then given a new category by a pass run. */
  async function boardThenAddMore(draftByPass: boolean) {
    const board: QuizBoard = { id: '', name: 'Draft', blurb: '', categories: [{ name: 'Old', clues: [{ clue: 'Private clue', answer: 'Private' }] }] };
    saveNewBoard(afterRun(board, draftByPass, true)); // as MakeBoard keeps the draft
    const clean = tidyBoard(loadNewBoard()!); // as BoardEditor saves it
    const saved = { ...clean, id: newBoardId(clean.name) };
    customQuiz.put(saved);
    await shareWizardPack('quiz', saved, true);
    saveNewBoard(null);
    const more = afterRun(addClues(kept(quizBoards(), saved.id), 'category', [{ category: 'New', level: 1, clue: 'Pass clue', answer: 'Pass' }]), true, false);
    customQuiz.put(more);
    return shareWizardPack('quiz', kept(quizBoards(), saved.id), true);
  }

  it('shares a Big Board drafted through a pass when, once saved, a pass run adds to it', async () => {
    const fetch = server();
    settings.wizardPass = PASS;
    expect(await boardThenAddMore(true)).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2); // on saving, then after Add more
    expect(JSON.parse(String(fetch.mock.calls[1][1]?.body)).items.map((c: { name: string }) => c.name)).toEqual(['Old', 'New']);
  });

  it("never shares a Big Board drafted with the host's key, even when a pass run adds to it", async () => {
    const fetch = server();
    settings.wizardPass = PASS;
    expect(await boardThenAddMore(false)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('leaves the mark out of pack files, imports and edits of built-in packs', () => {
    const own = afterRun<WordDeck>({ id: 'my-file-deck', name: 'File', emoji: '✨', blurb: '', words: ['Shrek'] }, true, true);
    const file = exportFile('forehead', [own]);
    expect(file).not.toContain('shared');
    const r = importPacks('forehead', file);
    if ('error' in r) throw new Error(r.error);
    expect(kept(customDecks.all(), r.saved[0].id).shared).toBeUndefined();
    customDecks.put({ ...kept(customDecks.builtins(), 'movies'), shared: true });
    expect(customDecks.saved().find((d) => d.id === 'movies')?.shared).toBeUndefined();
  });
});

describe('browsing and importing', () => {
  beforeEach(() => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) });
  });

  it('asks for one game, sorted and searched, with the pass when there is one', async () => {
    const fetch = server(() => Response.json({ packs: [], more: false }));
    expect(await listPacks('dial', { q: ' road trip ', sort: 'new', page: 2 })).toEqual({ ok: true, packs: [], more: false });
    expect(fetch.mock.calls[0][0]).toBe(`${WIZARD_SERVER}/library/packs?game=dial&sort=new&page=2&q=road+trip`);
    expect(new Headers(fetch.mock.calls[0][1]?.headers).has('authorization')).toBe(false);
    settings.wizardPass = PASS;
    await listPacks('dial');
    expect(new Headers(fetch.mock.calls[1][1]?.headers).get('authorization')).toBe(`Bearer ${PASS}`);
    server(() => new Response('', { status: 503 }));
    expect(await listPacks('dial')).toEqual({ ok: false, reason: 'server' });
  });

  it('rebuilds a fetched pack from its known fields only, before anything reads it', async () => {
    let deep: unknown = 'x';
    // Deep enough to show nothing walks it; Node 22 (the deploy's test run) can't JSON-encode 5,000 levels.
    for (let i = 0; i < 1000; i++) deep = [deep];
    const pack = { id: 'AAAAAAAAAAAA', game: 'dial', name: 'Road Trip', blurb: 'Snacks', count: 1, stars: 0, created: 1, updated: 2, owner: 'nope',
      items: [{ left: 'Bad snack', right: 'Good snack', deep }], extra: { deep } };
    server(() => new Response(JSON.stringify({ pack }), { headers: { 'content-type': 'application/json' } }));
    const r = await getPack('dial', 'AAAAAAAAAAAA');
    expect(r).toEqual({ ok: true, pack: { id: 'AAAAAAAAAAAA', game: 'dial', name: 'Road Trip', blurb: 'Snacks', count: 1, stars: 0, created: 1, updated: 2, items: [{ left: 'Bad snack', right: 'Good snack' }], extra: {},
      ready: { pack: { id: 'road-trip', name: 'Road Trip', blurb: 'Snacks', cards: [{ left: 'Bad snack', right: 'Good snack' }] }, dropped: 0, skipped: 0, problems: [] } } });
    server(() => Response.json({ pack: { ...pack, items: [{ left: 7 }] } }));
    expect(await getPack('dial', 'AAAAAAAAAAAA')).toEqual({ ok: false, reason: 'broken' });
    server(() => Response.json({ pack: { ...pack, game: 'quick' } }));
    expect(await getPack('dial', 'AAAAAAAAAAAA')).toEqual({ ok: false, reason: 'broken' });
  });

  it("shows a listed pack's username only when it is one, and nothing for packs shared without", async () => {
    const row = { id: 'AAAAAAAAAAAA', game: 'dial', name: 'Road Trip', blurb: '', count: 1, stars: 0, created: 1, updated: 2 };
    const names = ['  Sneaky   Otter ', 'x'.repeat(25), { deep: 1 }, undefined, '\u200B'];
    server(() => Response.json({ packs: names.map((username, i) => ({ ...row, id: `AAAAAAAAAAA${i}`, username })), more: false }));
    const r = await listPacks('dial');
    expect(r.ok && r.packs.map((p) => p.username)).toEqual(['Sneaky Otter', undefined, undefined, undefined, undefined]);
    expect(r.ok && Object.hasOwn(r.packs[1], 'username')).toBe(false);
  });

  it('forgets a pass the server refuses, so the phone asks for the words again', async () => {
    settings.wizardPass = PASS;
    server(() => new Response('', { status: 401 }));
    expect(await starPack('AAAAAAAAAAAA', true)).toEqual({ ok: false, reason: 'pass' });
    expect(settings.wizardPass).toBe('');
  });

  const shared = (over: Partial<LibraryFull>): LibraryFull => ({ id: 'AAAAAAAAAAAA', game: 'dial', name: 'Road Trip', blurb: 'Snacks', count: 2, stars: 0, created: 0, updated: 0, items: [], extra: {}, ...over });

  it('imports like a pack file, leaving out what the built-in packs already have, after tidying', () => {
    // " cold | HOT " tidies to the built-in "Cold | Hot" only once the game's own rules read it.
    const r = importLibraryPack('dial', shared({ items: [{ left: ' cold ', right: 'HOT ' }, { left: 'Bad snack', right: 'Good snack' }, { left: 'Bad snack', right: 'Good snack' }] }));
    if ('error' in r) throw new Error(r.error);
    expect((r.saved[0] as SpectrumPack).cards).toEqual([{ left: 'Bad snack', right: 'Good snack' }]);
    expect(r.saved[0]).toMatchObject({ name: 'Road Trip', blurb: 'Snacks' });
    expect([r.skipped, r.problems]).toEqual([1, ['1 already in the built-in packs left out.']]);
    expect(importLibraryPack('dial', shared({ items: [{ left: 'Cold', right: 'Hot' }] }))).toEqual({ error: 'Everything in this pack is already in the built-in packs.' });
  });

  it("imports a Snark Tank pack's stock answers and finals with its prompts", () => {
    const finals = [{ prompt: 'Three things to never say on a boat', house: ['Iceberg', 'Oops', 'Swim?'] }];
    const r = importLibraryPack('snark', shared({ game: 'snark', items: ['A bad name for a boat'], extra: { safety: { 'A bad name for a boat': 'Floaty' }, finals } }));
    if ('error' in r) throw new Error(r.error);
    expect(r.saved[0]).toMatchObject({ prompts: ['A bad name for a boat'], safety: { 'A bad name for a boat': 'Floaty' }, finals });
  });

  it("drops a Snark Tank stock answer with its prompt when a built-in pack has the prompt", () => {
    const r = importLibraryPack('snark', shared({ game: 'snark', items: ['A bad name for a boat', 'A bad first sentence for a wedding toast'], extra: { safety: { 'A bad first sentence for a wedding toast': 'Hi' } } }));
    if ('error' in r) throw new Error(r.error);
    expect([(r.saved[0] as SnarkPack).prompts, (r.saved[0] as SnarkPack).safety]).toEqual([['A bad name for a boat'], undefined]);
  });

  it('previews exactly what importing keeps, saying how many are left out', async () => {
    const body = { pack: { ...shared({ game: 'sketch', items: ['Pup tent', 'Cat'], extra: { ideas: ['A bear roasting marshmallows', `A ${'b'.repeat(70)} bear`] } }) } };
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })));
    const r = await getPack('sketch', body.pack.id);
    if (!r.ok) throw new Error(r.reason);
    expect([r.pack.items, r.pack.extra, r.pack.count, r.pack.leftOut]).toEqual([['Pup tent'], { ideas: ['A bear roasting marshmallows'] }, 2, 2]);
    const k = importLibraryPack('sketch', r.pack);
    if ('error' in k) throw new Error(k.error);
    expect(k.saved[0]).toMatchObject({ words: ['Pup tent'], ideas: ['A bear roasting marshmallows'] });
    // One with nothing to keep shows nothing, and cannot be imported.
    body.pack.items = ['Cat'];
    body.pack.extra = { ideas: [] } as never;
    const none = await getPack('sketch', body.pack.id);
    expect(none.ok && [none.pack.items, none.pack.ready]).toEqual([[], { error: 'Everything in this pack is already in the built-in packs.' }]);
  });

  it('will not send a Snark Tank pack whose stock answers or finals the library would drop', () => {
    const p = { id: 's', name: 'S', blurb: '', prompts: ['A bad name for a boat'] };
    expect(shareProblem('snark', { ...p, safety: { 'A bad name for a boat': 'Floaty', 'A prompt it lost': 'Old' } } as SnarkPack)).toBeNull();
    expect(shareProblem('snark', { ...p, safety: { 'A bad name for a boat': 'x'.repeat(81) } } as SnarkPack)).toMatch(/stock answers/);
    const final = { prompt: 'Three things to never say on a boat', house: ['Iceberg', 'Oops', 'Swim?'] };
    expect(shareProblem('snark', { ...p, finals: [final, { ...final }] } as SnarkPack)).toBe('Fix this final first: “Three things to never say on a boat” (repeated).');
  });

  it('never sends a pack the library would cut', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const answers = Array.from({ length: 401 }, (_, i) => `Answer ${i}`);
    expect(await publishPack('hand', { id: 'x', name: 'X', blurb: '', prompts: ['What got me through finals?'], answers } as HandPack)).toEqual({ ok: false, reason: 'broken' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('imports both lists of a Bad Hand or Sketchy pack, leaving out cards the built-ins have', () => {
    const r = importLibraryPack('hand', shared({ game: 'hand', items: ['My RA wrote me up for ___', 'my therapist says my biggest problem is ___'], extra: { answers: ['A rice cooker the size of a dog', 'not a card.'] } }));
    if ('error' in r) throw new Error(r.error);
    expect(r.saved[0]).toMatchObject({ prompts: ['My RA wrote me up for ___'], answers: ['A rice cooker the size of a dog', 'Not a card'] });
    expect(r.problems).toEqual(['1 already in the built-in packs left out.']);
    const k = importLibraryPack('sketch', shared({ game: 'sketch', items: ['Pup tent', 'Cat'], extra: { ideas: ['A bear roasting marshmallows'] } }));
    if ('error' in k) throw new Error(k.error);
    expect(k.saved[0]).toMatchObject({ words: ['Pup tent'], ideas: ['A bear roasting marshmallows'] });
  });

  it("keeps a Heads Down. pack's emoji and every word, built-in or not", () => {
    const r = importLibraryPack('forehead', shared({ game: 'forehead', items: ['Shrek', 'Pizza'], extra: { emoji: '📺' } }));
    if ('error' in r) throw new Error(r.error);
    expect(r.saved[0]).toMatchObject({ name: 'Road Trip', emoji: '📺', words: ['Shrek', 'Pizza'] });
  });
});

describe('sharing a pack by hand', () => {
  beforeEach(() => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) });
  });
  const own: WordDeck = { id: 'my-hand-deck', name: 'Hand made', emoji: '✨', blurb: 'Typed in', words: ['Shrek', 'Pizza'], custom: true };
  const board = (clue: string): QuizBoard => ({ id: 'my-board', name: 'Board', blurb: '', custom: true,
    categories: [{ name: 'Food', clues: [{ clue: 'Round, cheesy, sliced.', answer: 'Pizza' }, { clue, answer: 'Taco' }] }] });
  const saved = (id: string) => customDecks.all().find((d) => d.id === id);
  const sentBody = (fetch: ReturnType<typeof server>, n = 0) => JSON.parse(String(fetch.mock.calls[n][1]?.body));
  /** A server whose answer waits until `answer()` is called. */
  function slowServer() {
    let answer = () => {};
    const fetch = vi.fn(() => new Promise<Response>((done) => { answer = () => done(Response.json({ id: 'AAAAAAAAAAAA', created: true })); }));
    vi.stubGlobal('fetch', fetch);
    return { fetch, answer: () => answer() };
  }

  it("is offered for the phone's own packs only: never a built-in, its edit, a library import or an unsaved pack", () => {
    expect(canShare('forehead', own)).toBe(true);
    expect(canShare('forehead', { ...own, shared: true })).toBe(true);
    expect(canShare('forehead', { ...customDecks.builtins()[0], custom: false })).toBe(false);
    expect(canShare('forehead', { ...own, id: 'movies', words: ['Edited'] })).toBe(false);
    expect(canShare('forehead', { ...own, fromLibrary: true })).toBe(false);
    expect(canShare('forehead', { ...own, id: '' })).toBe(false);
    expect(canShare('salad', own)).toBe(false);
  });

  it('marks a pack imported from the library, so it is never offered again; a pack file import is', () => {
    const r = importLibraryPack('forehead', { id: 'AAAAAAAAAAAA', game: 'forehead', name: 'From the library', blurb: '', count: 1, stars: 0, created: 0, updated: 0, items: ['Shrek'], extra: {} });
    if ('error' in r) throw new Error(r.error);
    expect([r.saved[0].fromLibrary, canShare('forehead', r.saved[0])]).toEqual([true, false]);
    expect([...ownedIds('forehead')]).toEqual(['AAAAAAAAAAAA']);
    const file = importPacks('forehead', exportFile('forehead', [r.saved[0]]));
    if ('error' in file) throw new Error(file.error);
    expect([file.saved[0].fromLibrary, canShare('forehead', file.saved[0])]).toEqual([undefined, true]);
  });

  it('tells a pack never marked, one marked but never taken, one on its way, the version taken and one changed since', () => {
    const shared = { ...own, shared: true };
    const taken = { print: packPrint('forehead', shared), localId: shared.id };
    expect(shareStatus('forehead', own, undefined)).toBe('new');
    expect(shareStatus('forehead', shared, undefined)).toBe('unsent');
    expect(shareStatus('forehead', shared, taken, true)).toBe('sending');
    expect(shareStatus('forehead', shared, taken)).toBe('current');
    // Only what the library gets counts: the phone's own fields do not.
    expect(shareStatus('forehead', { ...shared, added: '2026-11-21T10:00' }, taken)).toBe('current');
    expect(shareStatus('forehead', { ...shared, words: ['Shrek', 'Pizza', 'Tacos'] }, taken)).toBe('changed');
    expect(shareStatus('forehead', { ...shared, name: 'Renamed' }, taken)).toBe('changed');
    expect(shareStatus('forehead', { ...shared, id: 'movies' }, undefined)).toBe('off');
  });

  it('says why a pack cannot go to the library as it is', () => {
    expect(shareProblem('forehead', own)).toBeNull();
    expect(shareProblem('forehead', { ...own, name: ' ' })).toBe('Give the pack a name first.');
    expect(shareProblem('forehead', { ...own, words: [] })).toBe('Add at least one word first.');
    expect(shareProblem('forehead', { ...own, words: Array.from({ length: 401 }, (_, i) => `Word ${i}`) })).toBe('Too big for the Community library: 400 words at most.');
    expect(shareProblem('quick', { id: 'my-q', name: 'Q', blurb: '', prompts: Array.from({ length: 380 }, (_, i) => `${i} ${'y'.repeat(190)}`) })).toBe('Too big for the Community library: 64 KB at most.');
    expect(shareProblem('quiz', board('Folded, crunchy shell.'))).toBeNull();
    expect(shareProblem('quiz', board(' '))).toBe('Fill the empty tile first.');
    const hand = { id: 'my-hand', name: 'H', blurb: '', prompts: ['What got me through finals?'], answers: ['Spite'] };
    expect(shareProblem('hand', hand)).toBeNull();
    expect(shareProblem('hand', { ...hand, prompts: [] })).toBe('Add at least one prompt first.');
    expect(shareProblem('hand', { ...hand, answers: Array.from({ length: 401 }, (_, i) => `Answer ${i}`) })).toBe('Too big for the Community library: 400 answers at most.');
    expect(shareProblem('sketch', { id: 'my-s', name: 'S', blurb: '', words: ['Tent'], ideas: ['x'.repeat(201)] })).toBe('Some items are too long for the Community library.');
  });

  it('sends and fingerprints the pack as saved, not as an editor shows it, and marks only the saved pack', async () => {
    settings.wizardPass = PASS;
    const fetch = server();
    customDecks.put({ ...own, id: 'my-saved-deck', name: 'Hand made' });
    customDecks.put({ ...own, id: 'my-other-deck', name: 'Other' }); // on top, so the order shows
    const onScreen = { ...own, id: 'my-saved-deck', name: 'Hand made  ', words: ['Not saved yet'] };
    expect(shareStatusNow('forehead', onScreen.id)).toBe('new');
    expect((await publishPack('forehead', onScreen)).ok).toBe(true);
    expect(sentBody(fetch)).toMatchObject({ name: 'Hand made', items: ['Shrek', 'Pizza'], localId: 'my-saved-deck' });
    expect((await shareByHand('forehead', 'my-saved-deck')).ok).toBe(true);
    expect([...ownedIds('forehead')]).toEqual(['AAAAAAAAAAAA']);
    expect(customDecks.all().map((d) => [d.id, d.shared])).toEqual([['my-other-deck', undefined], ['my-saved-deck', true]]);
    expect(saved('my-saved-deck')).toMatchObject({ name: 'Hand made', words: ['Shrek', 'Pizza'] });
    expect(shareStatusNow('forehead', 'my-saved-deck')).toBe('current');
    customDecks.put({ ...saved('my-saved-deck')!, words: ['Shrek'] });
    expect(shareStatusNow('forehead', 'my-saved-deck')).toBe('changed');
  });

  it('leaves a pack deleted while its share was on its way deleted, and an edit made meanwhile kept', async () => {
    settings.wizardPass = PASS;
    customDecks.put({ ...own, id: 'my-gone-deck' });
    let slow = slowServer();
    const gone = shareByHand('forehead', 'my-gone-deck');
    expect(shareStatusNow('forehead', 'my-gone-deck')).toBe('sending');
    customDecks.remove('my-gone-deck');
    slow.answer();
    expect((await gone).ok).toBe(true);
    expect(saved('my-gone-deck')).toBeUndefined();

    customDecks.put({ ...own, id: 'my-busy-deck' });
    slow = slowServer();
    const busy = shareByHand('forehead', 'my-busy-deck');
    customDecks.put({ ...own, id: 'my-busy-deck', words: ['Edited meanwhile'] });
    slow.answer();
    await busy;
    expect(saved('my-busy-deck')).toMatchObject({ words: ['Edited meanwhile'], shared: true });
    expect(shareStatusNow('forehead', 'my-busy-deck')).toBe('changed');
  });

  it('never claims a wizard pack is in the library before the library took it', async () => {
    settings.wizardPass = PASS;
    const wizard = afterRun<WordDeck>({ id: 'my-wizard-deck', name: 'Wizard', emoji: '✨', blurb: '', words: ['Shrek'] }, true, true);
    customDecks.put(wizard);
    const slow = slowServer();
    const going = shareWizardPack('forehead', wizard, true);
    expect(shareStatusNow('forehead', wizard.id)).toBe('sending');
    slow.answer();
    expect(await going).toBe(true);
    expect(shareStatusNow('forehead', wizard.id)).toBe('current');

    const offline = afterRun<WordDeck>({ ...wizard, id: 'my-offline-deck' }, true, true);
    customDecks.put(offline);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect(await shareWizardPack('forehead', offline, true)).toBe(false);
    expect(shareStatusNow('forehead', offline.id)).toBe('unsent');
  });

  it("keeps the library's id for a pack moved off a new built-in's id, so a share updates the same entry", async () => {
    settings.wizardPass = PASS;
    const fetch = server();
    // Shared under an id a later app version gives a built-in pack: the own pack moves to 'my-movies'.
    const early = { ...own, id: 'movies', shared: true };
    localStorage.setItem('hr:custom:decks', JSON.stringify([early]));
    noteShared('forehead', 'movies', { print: packPrint('forehead', early), localId: 'movies' });
    customDecks.settle(); // as the app does when it starts
    expect(customDecks.all().map((d) => d.id)).toEqual(['my-movies']);
    expect([lastShared('forehead', 'movies'), lastShared('forehead', 'my-movies')?.localId]).toEqual([undefined, 'movies']);
    expect(shareStatusNow('forehead', 'my-movies')).toBe('current');
    expect((await shareByHand('forehead', 'my-movies')).ok).toBe(true);
    expect(sentBody(fetch).localId).toBe('movies');
  });

  it('counts a Community pack as owned while a pack imported from it, or shared as it, is on the phone', async () => {
    const get = (id: string, name = 'Trip') => importLibraryPack('hand', { id, game: 'hand', name, blurb: '', count: 1, stars: 0, created: 0, updated: 0,
      items: [], extra: { answers: Array.from({ length: 2 }, (_, i) => `My ${name} answer ${i}`) } });
    const a = get('AAAAAAAAAAAA');
    if ('error' in a) throw new Error(a.error);
    expect(a.saved[0].communityId).toBe('AAAAAAAAAAAA');
    expect(exportFile('hand', a.saved)).not.toContain('AAAAAAAAAAAA');
    customHand.remove(a.saved[0].id);
    const b = get('BBBBBBBBBBBB'); // the same name, so the same id on this phone
    if ('error' in b) throw new Error(b.error);
    expect([b.saved[0].id, [...ownedIds('hand')]]).toEqual([a.saved[0].id, ['BBBBBBBBBBBB']]);

    // Through a move off a new built-in's id, and to each part of a pack split on import.
    localStorage.setItem('hr:custom:hand', JSON.stringify([{ ...b.saved[0], custom: true, id: customHand.builtins()[0].id }]));
    customHand.settle();
    expect([...ownedIds('hand')]).toEqual(['BBBBBBBBBBBB']);
    const parts = importLibraryPack('hand', { id: 'CCCCCCCCCCCC', game: 'hand', name: 'Big', blurb: '', count: 401, stars: 0, created: 0, updated: 0,
      items: [], extra: { answers: Array.from({ length: 401 }, (_, i) => `Big answer ${i}`) } });
    if ('error' in parts) throw new Error(parts.error);
    expect(parts.saved.map((p) => p.communityId)).toEqual(['CCCCCCCCCCCC', 'CCCCCCCCCCCC']);
  });

  it('never counts a new pack under a deleted one\'s id as shared', async () => {
    settings.wizardPass = PASS;
    const deck2 = { ...own, id: 'my-reused-deck' };
    server();
    customDecks.put(deck2);
    await shareByHand('forehead', deck2.id);
    expect([...ownedIds('forehead')]).toEqual(['AAAAAAAAAAAA']);
    customDecks.remove(deck2.id);
    customDecks.put(deck2);
    expect([lastShared('forehead', deck2.id), [...ownedIds('forehead')]]).toEqual([undefined, []]);
    // Deleted while its share was on its way, too.
    const slow = slowServer();
    const going = shareByHand('forehead', deck2.id);
    customDecks.remove(deck2.id);
    slow.answer();
    await going;
    customDecks.put(deck2);
    expect([...ownedIds('forehead')]).toEqual([]);
  });

  it('keeps what another tab noted as shared meanwhile', () => {
    noteShared('forehead', 'mine-a', { print: 'a', localId: 'mine-a' });
    const other = { ...JSON.parse(localStorage.getItem('hr:library:sent')!), 'forehead:theirs': { print: 'b', localId: 'theirs' } };
    localStorage.setItem('hr:library:sent', JSON.stringify(other));
    noteShared('forehead', 'mine-c', { print: 'c', localId: 'mine-c' });
    const stored = JSON.parse(localStorage.getItem('hr:library:sent')!);
    expect(['mine-a', 'theirs', 'mine-c'].map((id) => stored[`forehead:${id}`]?.print)).toEqual(['a', 'b', 'c']);
  });

  it("only reads while working out an import's names, even with a pack still to move off a new built-in's id", () => {
    localStorage.setItem('hr:custom:decks', JSON.stringify([{ ...own, id: 'movies' }]));
    noteShared('forehead', 'movies', { print: 'x', localId: 'movies' });
    const write = vi.spyOn(localStorage, 'setItem');
    const pack = { id: 'AAAAAAAAAAAA', game: 'forehead' as const, name: 'Hand made', blurb: '', count: 1, stars: 0, created: 0, updated: 0, items: ['Shrek'], extra: {} };
    expect(namesIfImported('forehead', pack)).toEqual(['Hand made (2)']);
    expect(customDecks.saved().map((d) => d.id)).toEqual(['my-movies']);
    expect(write).not.toHaveBeenCalled();
    expect(lastShared('forehead', 'movies')?.print).toBe('x');
    customDecks.put({ ...own, id: 'my-new-deck' }); // a write settles it first
    expect([customDecks.saved().map((d) => d.id), lastShared('forehead', 'my-movies')?.print]).toEqual([['my-new-deck', 'my-movies'], 'x']);
  });

  it('says what went wrong in plain words', async () => {
    settings.wizardPass = PASS;
    customDecks.put({ ...own, id: 'my-refused-deck' });
    server(() => new Response('', { status: 429 }));
    expect(await shareByHand('forehead', 'my-refused-deck')).toEqual({ ok: false, reason: 'limited' });
    expect(shareStatusNow('forehead', 'my-refused-deck')).toBe('new');
    expect(saved('my-refused-deck')?.shared).toBeUndefined();
    expect(failureWords('limited', 'share')).toMatch(/today/);
    server(() => new Response('', { status: 413 }));
    expect(await shareByHand('forehead', 'my-refused-deck')).toEqual({ ok: false, reason: 'big' });
    expect(failureWords('big', 'share')).toMatch(/too big.*64 KB/);
    expect(failureWords('pass', 'share')).toBe("Fizzwick's pass ran out. Say the magic words again to share packs.");
    expect(await shareByHand('forehead', 'my-no-such-deck')).toEqual({ ok: false, reason: 'missing' });
    expect(failureWords('missing', 'share')).toBe('This pack is no longer on this phone.');
  });
});
