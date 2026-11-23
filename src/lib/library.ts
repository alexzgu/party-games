// The Community library on the wizard server (worker/src/libraryRoutes.ts): packs Fizzwick made
// for friends, shared automatically from phones with a magic-words pass, and the phone's own packs
// a player shares with "Share to Community". Anyone can browse, preview and import; sharing by
// hand and starring need a pass. Everything fetched is rebuilt field by field
// (libraryShape.ts) before it is shown or kept; an imported pack then goes through the pack-file
// checks (packfile.ts), so it is saved exactly like a pack file.
import type { PackGameId } from '../app.config';
import { slugify } from './content';
import { viaPass } from './claude';
import { cleanExtra, cleanItems, cleanPublish, itemCount, SHAPE, text } from './libraryShape';
import { builtinPacks, FORMAT, isBuiltinPack, itemsField, listFields, markPackShared, NO_ROOM, ownPack, packParts, readFile, savedNames, savePacks, unitOf, type AnyPack, type ImportResult } from './packfile';
import { noteOwned } from './communityMarks.svelte';
import { isSending, lastShared, noteShared, setSending, type SharedRecord } from './shareLog.svelte';
import { saveSettings, settings } from './settings.svelte';
import { getUsername } from './username';
import { cleanUsername } from './usernameShape';
import { WIZARD_SERVER } from './wizardServer';
import { cardId as spectrumKey } from '../games/dial/state';
import { answerKey } from '../games/gibberish/parse';
import { promptKey } from '../games/quick/logic';
import { cardId as tabooKey } from '../games/taboo/cards';
import { finalsNote, readFinals } from '../games/snark/finals';
import { emptyTiles } from '../games/quiz/board';
import { titleKey } from '../games/brawl/rules';
import { promptKey as handPromptKey, sameKey as handKey } from '../games/hand/rules';
import { sameKey as sketchKey } from '../games/sketch/rules';

/**
 * Games with a Community entry in their pack list and whose wizard packs are shared. Adding a
 * game here turns both on; its make page (and Add more) then calls `shareWizardPack`.
 */
export const LIBRARY_GAMES: readonly PackGameId[] = ['forehead', 'dial', 'gibberish', 'quick', 'quiz', 'taboo', 'snark', 'brawl', 'hand', 'sketch'];

export const libraryOn = (game: string): game is PackGameId => !!WIZARD_SERVER && (LIBRARY_GAMES as readonly string[]).includes(game);

/** True when this phone has a magic-words pass (what starring needs). */
export const hasPass = (): boolean => !!WIZARD_SERVER && settings.wizardPass.trim().length > 0;

/** True when the wizard on this phone works through a pass, so the packs it makes are shared. */
export const sharesPacks = (): boolean => viaPass();

/**
 * Whether every wizard run behind the items on screen went through a pass. Call it as each run
 * starts, with what it said before and how many items are already on screen (none: a fresh start).
 */
export const passedSoFar = (before: boolean, onScreen: number): boolean => (onScreen === 0 || before) && viaPass();

/**
 * `pack` with its share mark after a wizard run, before it is saved. `byPass`: the run went
 * through a pass (`passedSoFar`). A pack the run `made` is marked when the run was through a
 * pass; one it added to keeps its mark only when it had one and the run was through a pass, so
 * a single run on the host's key or an invite link, or a start as a pasted, hand-made,
 * imported or built-in pack, keeps it private for good. A pack file never carries the mark.
 */
export function afterRun<P extends { shared?: boolean }>(pack: P, byPass: boolean, made: boolean): P {
  const { shared, ...rest } = pack;
  return (byPass && (made || shared === true) ? { ...rest, shared: true } : rest) as P;
}

/** What a make page says, once, while it shares. */
export const SHARED_NOTE = 'Packs Fizzwick makes are shared in the Community library.';
export const SHARE_FAILED = "Couldn't share to the library";

export interface LibraryPack {
  id: string;
  game: PackGameId;
  name: string;
  blurb: string;
  count: number;
  stars: number;
  /** Milliseconds since 1970. */
  created: number;
  updated: number;
  /** Only when the list was asked for with a pass. */
  starred?: boolean;
  /** The sharing phone's username; packs shared before usernames have none. */
  username?: string;
}

export interface LibraryFull extends LibraryPack {
  /** Rebuilt with the game's own fields only. */
  items: unknown[];
  extra: Record<string, unknown>;
  /** The pack as importing saves it, read once: the preview shows this and Import saves this. */
  ready?: ReadLibrary;
  /** Things of the pack an import leaves out (not usable here, or in a built-in pack). */
  leftOut?: number;
}

export type Sort = 'stars' | 'new';
export type Failure = 'offline' | 'server' | 'missing' | 'pass' | 'limited' | 'big' | 'broken';
export type Got<T> = ({ ok: true } & T) | { ok: false; reason: Failure };

async function call(path: string, init: RequestInit = {}, withPass = false, server = WIZARD_SERVER): Promise<Got<{ body: Record<string, unknown> }>> {
  const headers = new Headers(init.headers);
  const pass = withPass && hasPass() ? settings.wizardPass.trim() : '';
  if (pass) headers.set('authorization', `Bearer ${pass}`);
  let res: Response;
  try {
    res = await fetch(`${server}${path}`, { ...init, headers, cache: 'no-store', referrerPolicy: 'no-referrer' });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (!res.ok) {
    // The server no longer takes this pass (expired, or the words changed): forget it, as the
    // wizard does, so the phone asks for the words again. A newer pass saved meanwhile stays.
    if (res.status === 401 && pass && settings.wizardPass.trim() === pass) {
      settings.wizardPass = '';
      saveSettings();
    }
    const reason: Failure = res.status === 401 ? 'pass' : res.status === 404 ? 'missing' : res.status === 429 ? 'limited' : res.status === 413 ? 'big' : res.status >= 500 ? 'server' : 'broken';
    return { ok: false, reason };
  }
  const body = await res.json().catch(() => null);
  return body && typeof body === 'object' && !Array.isArray(body) ? { ok: true, body } : { ok: false, reason: 'broken' };
}

const num = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) ? x : 0);

/** A listed pack rebuilt from its known fields, or null. */
function summaryOf(game: PackGameId, x: unknown): LibraryPack | null {
  if (!x || typeof x !== 'object') return null;
  const r = x as Record<string, unknown>;
  const id = typeof r.id === 'string' && /^[\w-]{1,32}$/.test(r.id) ? r.id : null;
  const name = text(r.name, 60);
  if (!id || !name || r.game !== game) return null;
  const username = cleanUsername(r.username);
  return {
    id, game, name, blurb: text(r.blurb, 140, true) ?? '', count: num(r.count), stars: num(r.stars), created: num(r.created), updated: num(r.updated),
    ...(typeof r.starred === 'boolean' ? { starred: r.starred } : {}),
    ...(username ? { username } : {}),
  };
}

/** One page of a game's packs: most stars first, or newest; `q` searches names and descriptions. */
export async function listPacks(game: PackGameId, o: { q?: string; sort?: Sort; page?: number; signal?: AbortSignal } = {}): Promise<Got<{ packs: LibraryPack[]; more: boolean }>> {
  const params = new URLSearchParams({ game, sort: o.sort ?? 'stars', page: String(o.page ?? 1) });
  if (o.q?.trim()) params.set('q', o.q.trim());
  const r = await call(`/library/packs?${params}`, { signal: o.signal }, true);
  if (!r.ok) return r;
  if (!Array.isArray(r.body.packs)) return { ok: false, reason: 'broken' };
  const packs = r.body.packs.slice(0, 100).map((p) => summaryOf(game, p)).filter((p): p is LibraryPack => p !== null);
  return { ok: true, packs, more: r.body.more === true };
}

/** One pack whole, rebuilt with its game's own fields (anything else in the answer is never read). */
export async function getPack(game: PackGameId, id: string, signal?: AbortSignal): Promise<Got<{ pack: LibraryFull }>> {
  const r = await call(`/library/packs/${encodeURIComponent(id)}`, { signal }, true);
  if (!r.ok) return r;
  const raw = r.body.pack as Record<string, unknown> | undefined;
  const summary = summaryOf(game, raw);
  const items = cleanItems(game, raw?.items);
  if (!summary || 'problem' in items) return { ok: false, reason: 'broken' };
  return { ok: true, pack: asImported(game, { ...summary, items: items.items, extra: cleanExtra(game, raw?.extra, items.items) }, raw ?? {}) };
}

export async function starPack(id: string, on: boolean): Promise<Got<{ stars: number; starred: boolean }>> {
  const r = await call(`/library/packs/${encodeURIComponent(id)}/star`, { method: on ? 'POST' : 'DELETE' }, true);
  return r.ok ? { ok: true, stars: num(r.body.stars), starred: r.body.starred === true } : r;
}

/** What of a pack goes to the library: its name, description, items and the fields beside them. */
function contentOf(game: PackGameId, pack: AnyPack) {
  return { name: pack.name.slice(0, 60), blurb: pack.blurb.slice(0, 140), ...packParts(game, pack) };
}

/**
 * Publishes the whole pack with this phone's username: the version saved on this phone when there
 * is one (what an editor shows may not be saved as it is yet), else `pack` as given. The same
 * pass, game and id update the entry made before; a pack whose id changed since keeps the id the
 * library knows. While it is on its way the pack counts as sending; once the server takes it,
 * what was sent is noted (`packPrint`), so the pack's editor can tell when it has changed since,
 * and with `mark` the saved pack is marked shared (`markPackShared`) in the same step. It counts as
 * owned under the id the library gives it.
 */
export async function publishPack(game: PackGameId, pack: AnyPack, mark = false): Promise<Got<{ id: string }>> {
  const sent = ownPack(game, pack.id) ?? pack;
  // Never sent when the library would not take it whole: it would look shared with items missing.
  // (A Big Board is never cut, and one with tiles still to fill is shared by the wizard as it is.)
  if (game !== 'quiz' && shareProblem(game, sent)) return { ok: false, reason: 'broken' };
  const localId = lastShared(game, sent.id)?.localId ?? sent.id;
  const body = { game, ...contentOf(game, sent), localId, username: getUsername() };
  setSending(game, sent.id, true);
  let r: Awaited<ReturnType<typeof call>>;
  try {
    r = await call('/library/packs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, true);
  } finally {
    setSending(game, sent.id, false);
  }
  if (!r.ok) return r;
  if (mark) markPackShared(game, sent.id);
  noteShared(game, sent.id, { print: packPrint(game, sent), localId });
  if (typeof r.body.id === 'string') noteOwned(game, r.body.id, [sent.id]);
  return { ok: true, id: String(r.body.id) };
}

/** A short fingerprint of what of `pack` the library gets: equal prints, same shared version. */
export function packPrint(game: PackGameId, pack: AnyPack): string {
  const s = JSON.stringify(contentOf(game, pack));
  let h = 0x811c9dc5; // FNV-1a, 32 bits
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return `${s.length.toString(36)}.${(h >>> 0).toString(36)}`;
}

// ---- Sharing a pack by hand ("Share to Community" in a pack editor)

/**
 * True for a pack a player may share by hand: their own pack, saved on this phone, in a game
 * with the library. Never a built-in pack or an edit of one, and never one imported from the
 * Community library (it is there already). Pasted, hand-made, wizard-made and file-imported
 * packs all qualify.
 */
export const canShare = (game: string, pack: AnyPack): boolean =>
  libraryOn(game) && !!pack.id && !isBuiltinPack(game, pack.id) && pack.fromLibrary !== true;

export type ShareStatus = 'off' | 'sending' | 'new' | 'unsent' | 'current' | 'changed';

/**
 * Where a saved pack stands with the library, from what this phone knows: `off` (it cannot be
 * shared), `sending` (on its way now), `new` (never marked for sharing: the first share asks
 * first), `unsent` (marked, by the wizard or an earlier share, but this phone has no record of the
 * library taking it: an automatic share failed, or it was shared before records were kept),
 * `current` (the version the library took) or `changed` (taken, then changed).
 * `last` is the record of what the library last took (`lastShared`).
 */
export function shareStatus(game: string, pack: AnyPack, last: SharedRecord | undefined, sending = false): ShareStatus {
  if (!canShare(game, pack)) return 'off';
  if (sending) return 'sending';
  if (pack.shared !== true) return 'new';
  if (!last) return 'unsent';
  return last.print === packPrint(game as PackGameId, pack) ? 'current' : 'changed';
}

/** `shareStatus` of the pack as saved on this phone (`off` when it is not one of its own saved packs). */
export function shareStatusNow(game: PackGameId, id: string): ShareStatus {
  const saved = ownPack(game, id);
  return saved ? shareStatus(game, saved, lastShared(game, id), isSending(game, id)) : 'off';
}

/**
 * Shares the player's own saved pack by hand (`canShare`), as saved, and once the library takes
 * it marks the saved pack shared, changing nothing else: a pack deleted meanwhile stays deleted.
 */
export async function shareByHand(game: PackGameId, id: string): Promise<Got<{ id: string }>> {
  const saved = ownPack(game, id);
  if (!saved || !canShare(game, saved)) return { ok: false, reason: 'missing' };
  return publishPack(game, saved, true);
}

/**
 * Why the pack cannot go to the library as it is, in plain words, or null: the library's own
 * rules (libraryShape.ts, the ones the server stores by), a Big Board's empty tiles, and Snark Tank
 * finals an import would leave out.
 */
export function shareProblem(game: PackGameId, pack: AnyPack): string | null {
  if (!pack.name.trim()) return 'Give the pack a name first.';
  const gaps = game === 'quiz' ? emptyTiles(pack as Parameters<typeof emptyTiles>[0]).length : 0;
  if (gaps) return `Fill the ${gaps === 1 ? 'empty tile' : `${gaps} empty tiles`} first.`;
  const { items, extra } = packParts(game, pack);
  const unit = unitOf(game);
  // A two-list pack's main list carries it in the library (Bad Hand: prompts; Sketchy: words).
  const [main, ...rest] = listFields(game);
  const one = rest.length ? main.slice(0, -1) : unitOf(game, 1);
  if (!items.length || (game === 'quiz' && !itemCount(game, items))) return `Add at least one ${one} first.`;
  const lists = [items, ...rest.map((f) => (Array.isArray(extra[f]) ? (extra[f] as unknown[]) : []))];
  const big = game === 'quiz' ? -1 : lists.findIndex((l) => l.length > SHAPE.itemsMax);
  if (big >= 0) return `Too big for the Community library: ${SHAPE.itemsMax} ${rest.length ? listFields(game)[big] : unit} at most.`;
  if (Array.isArray(extra.finals) && extra.finals.length > SHAPE.snarkFinals) return `Too big for the Community library: ${SHAPE.snarkFinals} finals at most.`;
  const unusable = Array.isArray(extra.finals) ? finalsNote(readFinals(extra.finals).dropped) : '';
  if (unusable) return unusable;
  const kept = cleanExtra(game, extra, items);
  if (rest.some((f, i) => ((kept[f] as unknown[] | undefined)?.length ?? 0) !== lists[i + 1].length)) return `Some ${unit} are too long for the Community library.`;
  if ('problem' in cleanItems(game, items)) return `Some ${unit} are too long for the Community library.`;
  const sent = cleanPublish(game, items, extra);
  if ('problem' in sent) return game === 'snark' ? 'Some stock answers or finals cannot be used in the Community library.' : `Some ${unit} are repeated or cannot be used in the game.`;
  if (new TextEncoder().encode(JSON.stringify({ items, extra })).length > SHAPE.bytesMax) {
    return `Too big for the Community library: ${SHAPE.bytesMax / 1024} KB at most.`;
  }
  return null;
}

// ---- Sharing what the wizard made

const listeners = new Set<(note: string) => void>();

/** Calls `fn` with the note to show when a share failed; returns the way to stop. */
export function onLibraryNote(fn: (note: string) => void): () => void {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}

/**
 * Shares a pack the wizard made, or one it just added to, whole, when the pack is marked shared
 * (`afterRun`) and `byPass`: this run went through a magic-words pass. Anything made with the
 * host's own key or an invite link, now or in an earlier run, keeps it private even once the
 * phone has a pass. Nothing happens either for a game without the library or a built-in pack.
 * Call it after saving (the saved version is what goes) and don't wait for it: it never throws;
 * a failure only shows a small note, and the pack's editor then offers to share it.
 */
export async function shareWizardPack(game: PackGameId, pack: AnyPack, byPass: boolean): Promise<boolean> {
  if (pack.shared !== true || !byPass || !hasPass() || !libraryOn(game) || isBuiltinPack(game, pack.id)) return false;
  let ok = false;
  try {
    ok = (await publishPack(game, pack)).ok;
  } catch {
    ok = false;
  }
  if (!ok) for (const fn of listeners) fn(SHARE_FAILED);
  return ok;
}

// ---- Importing

type Key = (x: never) => string;
/** Games whose items must be new across packs, and how one is told apart, by list. */
const UNIQUE: Partial<Record<PackGameId, Record<string, Key>>> = {
  dial: { cards: spectrumKey }, gibberish: { cards: answerKey }, quick: { prompts: promptKey }, taboo: { cards: tabooKey },
  snark: { prompts: (q: string) => q.trim().toLowerCase() },
  brawl: { titles: titleKey }, hand: { prompts: handPromptKey, answers: handKey }, sketch: { words: sketchKey, ideas: sketchKey },
};

/** `pack` without the items a built-in pack already has (for games whose items are unique across packs). */
export function withoutBuiltins(game: PackGameId, pack: AnyPack): { pack: AnyPack; dropped: number } {
  const keys = UNIQUE[game];
  if (!keys) return { pack, dropped: 0 };
  const listOf = (p: AnyPack, f: string): unknown[] => (p as unknown as Record<string, unknown[]>)[f] ?? [];
  const next = { ...pack } as AnyPack & { safety?: Record<string, string> };
  let dropped = 0;
  for (const [field, k] of Object.entries(keys)) {
    const key = k as (x: unknown) => string;
    const taken = new Set(builtinPacks(game).flatMap((p) => listOf(p, field).map(key)));
    const items = listOf(pack, field);
    const kept = items.filter((x) => !taken.has(key(x)));
    (next as unknown as Record<string, unknown[]>)[field] = kept;
    dropped += items.length - kept.length;
  }
  // A Snark Tank stock answer goes with its prompt.
  if (next.safety) {
    const kept = listOf(next, 'prompts') as string[];
    const stock = Object.entries(next.safety).filter(([q]) => kept.includes(q));
    if (stock.length) next.safety = Object.fromEntries(stock);
    else delete next.safety;
  }
  return { pack: next, dropped };
}

type ReadLibrary = { pack: AnyPack; dropped: number; skipped: number; problems: string[] } | { error: string };

/** A library pack as an import keeps it: read like a pack file, then without what a built-in pack already has. */
function readLibraryPack(game: PackGameId, pack: LibraryFull): ReadLibrary {
  // The extras were rebuilt with the game's own fields only (cleanExtra): emoji, stock answers and finals, a second list.
  const file = { jerkBox: FORMAT, game, packs: [{ id: slugify(pack.name) || 'community-pack', name: pack.name, blurb: pack.blurb, ...pack.extra, [itemsField(game)]: pack.items }] };
  const read = readFile(JSON.stringify(file), game);
  if ('error' in read) return read;
  const { pack: tidied, dropped } = withoutBuiltins(game, read.packs[0]);
  if (!listFields(game).some((f) => ((tidied as unknown as Record<string, unknown[]>)[f] ?? []).length)) {
    return { error: dropped ? 'Everything in this pack is already in the built-in packs.' : 'This pack has nothing in it.' };
  }
  return { pack: tidied, dropped, skipped: read.skipped, problems: read.problems };
}

/** Everything in a pack: its items, its second list, a Snark Tank pack's stock answers and finals. */
function thingsIn(items: unknown, extra: unknown): number {
  const e = (extra && typeof extra === 'object' ? extra : {}) as Record<string, unknown>;
  const n = (x: unknown) => (Array.isArray(x) ? x.length : 0);
  return n(items) + n(e.answers) + n(e.ideas) + n(e.finals) + Object.keys((e.safety ?? {}) as object).length;
}

/** A fetched pack as importing it saves it, with how much of `raw` (as the server sent it) that leaves out. */
function asImported(game: PackGameId, pack: LibraryFull, raw: Record<string, unknown>): LibraryFull {
  const ready = readLibraryPack(game, pack);
  if ('error' in ready) return { ...pack, items: [], extra: {}, count: 0, ready };
  const { items, extra } = packParts(game, ready.pack);
  const leftOut = game === 'quiz' ? ready.skipped : Math.max(0, thingsIn(raw.items, raw.extra) - thingsIn(items, extra));
  return { ...pack, name: ready.pack.name, blurb: ready.pack.blurb, items, extra, count: itemCount(game, items, extra), ready, ...(leftOut ? { leftOut } : {}) };
}

/** The names a library pack would be saved under now (several for one split into parts, none for one that can't be imported). */
export function namesIfImported(game: PackGameId, pack: LibraryFull): string[] {
  const read = pack.ready ?? readLibraryPack(game, pack);
  return 'error' in read ? [] : savedNames(game, [read.pack]);
}

/** "Saves as “Movies (2)”." when the saved names are not just the pack's own, else ''. */
export function namesNote(name: string, names: readonly string[]): string {
  if (!names.length || (names.length === 1 && names[0] === name)) return '';
  const list = names.map((n) => `“${n}”`).join(', ');
  return names.length > 1 ? `Saves as ${names.length} packs: ${list}.` : `Saves as ${list}.`;
}

/**
 * Saves a library pack on this phone as the player's own: exactly what its preview showed (`ready`;
 * each item checked and tidied by its game's own rules, without what a built-in pack already has),
 * marked `fromLibrary`, so it is never shared again from this phone, and owned (communityMarks).
 */
export function importLibraryPack(game: PackGameId, pack: LibraryFull): ImportResult {
  const read = pack.ready ?? readLibraryPack(game, pack);
  if ('error' in read) return read;
  const problems = read.dropped ? [...read.problems, `${read.dropped} already in the built-in packs left out.`] : read.problems;
  const saved = savePacks(game, [{ ...read.pack, fromLibrary: true }]);
  if (!saved.length) return { error: NO_ROOM };
  noteOwned(game, pack.id, saved.map((p) => p.id));
  return { saved, skipped: read.skipped, problems };
}

/** What a failed library call means, in plain words; `doing` says what the player was doing. */
export function failureWords(reason: Failure, doing: 'star' | 'share' = 'star'): string {
  if (reason === 'offline') return "Couldn't reach the Community library. Check the internet and try again.";
  if (reason === 'missing') return doing === 'share' ? 'This pack is no longer on this phone.' : 'That pack is no longer in the library.';
  if (reason === 'pass') return `Fizzwick's pass ran out. Say the magic words again to ${doing} packs.`;
  // A share is refused with 429 only at the daily caps (one pass's, or everyone's together).
  if (reason === 'limited') return doing === 'share' ? "That's all the sharing the library takes for today. Try again tomorrow." : 'The library is busy. Try again later.';
  if (reason === 'big') return `This pack is too big for the Community library: ${SHAPE.bytesMax / 1024} KB at most.`;
  if (reason === 'broken' && doing === 'share') return "The Community library couldn't take this pack as it is.";
  return 'The Community library is having trouble. Try again in a little while.';
}
