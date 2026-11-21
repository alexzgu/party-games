// The Community library's phone side without a browser: a fake fetch and a fake pass only.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { settings } from './settings.svelte';
import { afterRun, getPack, importLibraryPack, listPacks, onLibraryNote, passedSoFar, SHARE_FAILED, shareWizardPack, starPack, type LibraryFull } from './library';
import { WIZARD_SERVER } from './wizardServer';
import { customDecks, customQuick, customQuiz, quizBoards, type QuickPack, type QuizBoard, type SnarkPack, type SpectrumPack, type WordDeck } from './content';
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
    expect(await shareWizardPack('forehead', deck, true)).toBe(true);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${WIZARD_SERVER}/library/packs`);
    expect(new Headers(init?.headers).get('authorization')).toBe(`Bearer ${PASS}`);
    expect(JSON.parse(String(init?.body))).toEqual({ game: 'forehead', name: 'Cartoons', blurb: 'Conjured by Fizzwick: cartoons', localId: 'my-cartoons-abc', items: ['Shrek', 'SpongeBob'], extra: { emoji: '📺' } });
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
    for (let i = 0; i < 5000; i++) deep = [deep];
    const pack = { id: 'AAAAAAAAAAAA', game: 'dial', name: 'Road Trip', blurb: 'Snacks', count: 1, stars: 0, created: 1, updated: 2, owner: 'nope',
      items: [{ left: 'Bad snack', right: 'Good snack', deep }], extra: { deep } };
    server(() => new Response(JSON.stringify({ pack }), { headers: { 'content-type': 'application/json' } }));
    const r = await getPack('dial', 'AAAAAAAAAAAA');
    expect(r).toEqual({ ok: true, pack: { id: 'AAAAAAAAAAAA', game: 'dial', name: 'Road Trip', blurb: 'Snacks', count: 1, stars: 0, created: 1, updated: 2, items: [{ left: 'Bad snack', right: 'Good snack' }], extra: {} } });
    server(() => Response.json({ pack: { ...pack, items: [{ left: 7 }] } }));
    expect(await getPack('dial', 'AAAAAAAAAAAA')).toEqual({ ok: false, reason: 'broken' });
    server(() => Response.json({ pack: { ...pack, game: 'quick' } }));
    expect(await getPack('dial', 'AAAAAAAAAAAA')).toEqual({ ok: false, reason: 'broken' });
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

  it("keeps a Heads Down. pack's emoji and every word, built-in or not", () => {
    const r = importLibraryPack('forehead', shared({ game: 'forehead', items: ['Shrek', 'Pizza'], extra: { emoji: '📺' } }));
    if ('error' in r) throw new Error(r.error);
    expect(r.saved[0]).toMatchObject({ name: 'Road Trip', emoji: '📺', words: ['Shrek', 'Pizza'] });
  });
});
