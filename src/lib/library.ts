// The Community library on the wizard server (worker/src/libraryRoutes.ts): packs Fizzwick made
// for friends, shared automatically from phones with a magic-words pass. Anyone can browse,
// preview and import; starring needs a pass. Everything fetched is rebuilt field by field
// (libraryShape.ts) before it is shown or kept; an imported pack then goes through the pack-file
// checks (packfile.ts), so it is saved exactly like a pack file.
import type { PackGameId } from '../app.config';
import { slugify } from './content';
import { viaPass } from './claude';
import { cleanExtra, cleanItems, text } from './libraryShape';
import { builtinPacks, FORMAT, isBuiltinPack, itemsField, packParts, readFile, savePacks, type AnyPack, type ImportResult } from './packfile';
import { saveSettings, settings } from './settings.svelte';
import { WIZARD_SERVER } from './wizardServer';
import { cardId as spectrumKey } from '../games/dial/state';
import { answerKey } from '../games/gibberish/parse';
import { promptKey } from '../games/quick/logic';
import { cardId as tabooKey } from '../games/taboo/cards';

/**
 * Games with a Community entry in their pack list and whose wizard packs are shared. Adding a
 * game here turns both on; its make page (and Add more) then calls `shareWizardPack`.
 */
export const LIBRARY_GAMES: readonly PackGameId[] = ['forehead', 'dial', 'gibberish', 'quick', 'quiz', 'taboo', 'snark'];

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
}

export interface LibraryFull extends LibraryPack {
  /** Rebuilt with the game's own fields only. */
  items: unknown[];
  extra: Record<string, unknown>;
}

export type Sort = 'stars' | 'new';
export type Failure = 'offline' | 'server' | 'missing' | 'pass' | 'limited' | 'broken';
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
    const reason: Failure = res.status === 401 ? 'pass' : res.status === 404 ? 'missing' : res.status === 429 ? 'limited' : res.status >= 500 ? 'server' : 'broken';
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
  return {
    id, game, name, blurb: text(r.blurb, 140, true) ?? '', count: num(r.count), stars: num(r.stars), created: num(r.created), updated: num(r.updated),
    ...(typeof r.starred === 'boolean' ? { starred: r.starred } : {}),
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
  return { ok: true, pack: { ...summary, items: items.items, extra: cleanExtra(game, raw?.extra, items.items) } };
}

export async function starPack(id: string, on: boolean): Promise<Got<{ stars: number; starred: boolean }>> {
  const r = await call(`/library/packs/${encodeURIComponent(id)}/star`, { method: on ? 'POST' : 'DELETE' }, true);
  return r.ok ? { ok: true, stars: num(r.body.stars), starred: r.body.starred === true } : r;
}

/** Publishes the whole pack; the same pass and pack id update the entry it made before. */
export async function publishPack(game: PackGameId, pack: AnyPack): Promise<Got<{ id: string }>> {
  const { items, extra } = packParts(game, pack);
  const body = { game, name: pack.name.slice(0, 60), blurb: pack.blurb.slice(0, 140), localId: pack.id, items, extra };
  const r = await call('/library/packs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, true);
  return r.ok ? { ok: true, id: String(r.body.id) } : r;
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
 * Call it after saving and don't wait for it: it never throws; a failure only shows a small note.
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

/** Games whose items must be new across packs, and how one is told apart. */
const UNIQUE: Partial<Record<PackGameId, (x: never) => string>> = {
  dial: spectrumKey, gibberish: answerKey, quick: promptKey, taboo: tabooKey, snark: (q: string) => q.trim().toLowerCase(),
};

/** `pack` without the items a built-in pack already has (for games whose items are unique across packs). */
export function withoutBuiltins(game: PackGameId, pack: AnyPack): { pack: AnyPack; dropped: number } {
  const key = UNIQUE[game] as ((x: unknown) => string) | undefined;
  const field = itemsField(game);
  const items = (pack as unknown as Record<string, unknown[]>)[field];
  if (!key) return { pack, dropped: 0 };
  const taken = new Set(builtinPacks(game).flatMap((p) => ((p as unknown as Record<string, unknown[]>)[field] ?? []).map(key)));
  const kept = items.filter((x) => !taken.has(key(x)));
  const next = { ...pack, [field]: kept } as AnyPack & { safety?: Record<string, string> };
  // A Snark Tank stock answer goes with its prompt.
  if (next.safety) {
    const stock = Object.entries(next.safety).filter(([q]) => (kept as string[]).includes(q));
    if (stock.length) next.safety = Object.fromEntries(stock);
    else delete next.safety;
  }
  return { pack: next, dropped: items.length - kept.length };
}

/**
 * Saves a library pack on this phone as the player's own: read like a pack file (each item
 * checked and tidied by its game's own rules), then without what a built-in pack already has.
 */
export function importLibraryPack(game: PackGameId, pack: LibraryFull): ImportResult {
  const keep = game === 'forehead' ? { emoji: pack.extra.emoji } : game === 'snark' ? { safety: pack.extra.safety, finals: pack.extra.finals } : {};
  const file = { jerkBox: FORMAT, game, packs: [{ id: slugify(pack.name) || 'community-pack', name: pack.name, blurb: pack.blurb, ...keep, [itemsField(game)]: pack.items }] };
  const read = readFile(JSON.stringify(file), game);
  if ('error' in read) return read;
  const { pack: clean, dropped } = withoutBuiltins(game, read.packs[0]);
  if (!(clean as unknown as Record<string, unknown[]>)[itemsField(game)].length) {
    return { error: dropped ? 'Everything in this pack is already in the built-in packs.' : 'This pack has nothing in it.' };
  }
  const problems = dropped ? [...read.problems, `${dropped} already in the built-in packs left out.`] : read.problems;
  return { saved: savePacks(game, [clean]), skipped: read.skipped, problems };
}

/** What a failed library call means, in plain words. */
export function failureWords(reason: Failure): string {
  if (reason === 'offline') return "Couldn't reach the Community library. Check the internet and try again.";
  if (reason === 'missing') return 'That pack is no longer in the library.';
  if (reason === 'pass') return "Fizzwick's pass ran out. Say the magic words again to star packs.";
  if (reason === 'limited') return 'The library is busy. Try again later.';
  return 'The Community library is having trouble. Try again in a little while.';
}
