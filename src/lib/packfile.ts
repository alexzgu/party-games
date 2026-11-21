// Pack files: packs saved to a file to keep or send to friends, and read back in on any phone.
// A file is {"jerkBox": 1, "game": "<game id>", "packs": [...]}, each pack in its stored shape
// without the fields that only mean something on one phone (custom, added). Reading a file
// checks every item with that game's own rules (the ones its pack editor or paste route uses),
// drops the items that fail with a count, and saves each pack as the player's own under an id
// nothing on the phone uses yet, so an import never overwrites a pack.
import { APP, gameName, GAMES, RETIRED_GAMES, type PackGameId } from '../app.config';
import {
  customDecks, customGibberish, customQuick, customQuiz, customSnark, customSpectra, customTaboo, slugify,
  type GibberishCard, type GibberishPack, type QuickPack, type QuizBoard, type QuizCategory, type SnarkFinal, type SnarkPack,
  type Spectrum, type SpectrumPack, type TabooCard, type TabooPack, type WordDeck,
} from './content';
import { MAX_ITEM_CHARS, MAX_WORDS_PER_ITEM } from '../games/forehead/words';
import { parsePair } from '../games/dial/generate';
import { cardId as spectrumId } from '../games/dial/state';
import { checkCard } from '../games/gibberish/parse';
import { MAX_CATEGORIES, MAX_LEVELS, sizeProblem, tidyBoard } from '../games/quiz/board';
import { cleanPrompt, promptError } from '../games/quick/parse';
import { promptProblem } from '../games/snark/prompts';
import { ANSWER_MAX, LINE_MAX } from '../games/snark/logic';
import { cardId as tabooId, cardProblems, tidy as tidyTaboo } from '../games/taboo/cards';

export const FORMAT = 1;
export const MAX_FILE_BYTES = 1_000_000;
/** Limits of the file format, well above any pack made so far. */
export const MAX_PACKS = 100;
export const MAX_ITEMS = 1000;

export type AnyPack = WordDeck | SpectrumPack | GibberishPack | QuizBoard | QuickPack | SnarkPack | TabooPack;
type Field = 'words' | 'cards' | 'categories' | 'prompts';

const FIELD: Record<PackGameId, Field> = {
  forehead: 'words', dial: 'cards', gibberish: 'cards', quiz: 'categories', quick: 'prompts', snark: 'prompts', taboo: 'cards',
};
/** What the items are called on screen, plural. */
const UNIT: Record<PackGameId, string> = {
  forehead: 'words', dial: 'cards', gibberish: 'cards', quiz: 'clues', quick: 'prompts', snark: 'prompts', taboo: 'cards',
};

const NOT_A_PACK_FILE = `This isn't a ${APP.name} pack file.`;

// ---- Writing

/**
 * The pack as it goes in a file: id, name, emoji (Heads Down. only), blurb and items (Snark Tank:
 * stock answers and finals too, when it has them).
 */
function plain(game: PackGameId, p: AnyPack): Record<string, unknown> {
  const field = FIELD[game];
  const { safety, finals } = game === 'snark' ? (p as SnarkPack) : {};
  return {
    id: p.id, name: p.name, ...(game === 'forehead' ? { emoji: (p as WordDeck).emoji } : {}), blurb: p.blurb,
    [field]: (p as unknown as Record<Field, unknown>)[field],
    ...(safety ? { safety } : {}), ...(finals ? { finals } : {}),
  };
}

export function exportFile(game: PackGameId, packs: readonly AnyPack[]): string {
  return JSON.stringify({ jerkBox: FORMAT, game, packs: packs.map((p) => plain(game, p)) }, null, 2);
}

/** "heads-down-movies.jerkbox.txt", or "…-my-packs.jerkbox.txt" for every pack of one phone. */
export const fileName = (game: PackGameId, packId?: string): string =>
  `${slugify(gameName(game))}-${packId ? slugify(packId) : 'my-packs'}.jerkbox.txt`;

/**
 * The file to hand over. Plain text, because Chrome on Android shares only some file types
 * (text and media, not JSON: share_service_impl.cc), and a pack file should go straight to a chat.
 */
export const packFile = (game: PackGameId, packs: readonly AnyPack[], packId?: string): File =>
  new File([exportFile(game, packs)], fileName(game, packId), { type: 'text/plain' });

/** What the import button accepts: these files, and JSON ones saved by hand. */
export const PACK_FILE_ACCEPT = '.txt,.json,text/plain,application/json';

// ---- Reading

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const text = (x: unknown): string => (typeof x === 'string' ? x.trim().replace(/\s+/g, ' ') : '');

interface Kept<T> { items: T[]; skipped: number }

/** Each raw item through `read` (null drops it); `key` drops repeats. */
function keep<T>(raw: unknown[], read: (x: unknown, kept: T[]) => T | null, key?: (t: T) => string): Kept<T> {
  const items: T[] = [];
  const seen = new Set<string>();
  for (const x of raw.slice(0, MAX_ITEMS)) {
    const t = read(x, items);
    if (t === null || (key && seen.has(key(t)))) continue;
    if (key) seen.add(key(t));
    items.push(t);
  }
  return { items, skipped: raw.length - items.length };
}

/** A Heads Down. word: what the deck editor takes, within the generated words' limits. */
function word(x: unknown): string | null {
  const w = text(x);
  return w && w.length <= MAX_ITEM_CHARS && w.split(' ').length <= MAX_WORDS_PER_ITEM ? w : null;
}

const spectrum = (x: unknown): Spectrum | null =>
  isObj(x) && typeof x.left === 'string' && typeof x.right === 'string' ? parsePair(`${x.left} | ${x.right}`) : null;

function gibberish(x: unknown, kept: GibberishCard[]): GibberishCard | null {
  if (!isObj(x) || typeof x.phrase !== 'string' || typeof x.answer !== 'string') return null;
  return checkCard({ phrase: x.phrase, answer: x.answer, hint: typeof x.hint === 'string' ? x.hint : '' }, kept).card;
}

function quick(x: unknown, kept: string[]): string | null {
  const p = typeof x === 'string' ? cleanPrompt(x) : '';
  return p && !promptError(p, kept) ? p : null;
}

function snark(x: unknown): string | null {
  const q = text(x);
  return q && !promptProblem(q) ? q : null;
}

/** A Snark pack's stock answers, kept only for prompts the pack still has (1–80 characters each). */
function safety(x: unknown, prompts: string[]): Record<string, string> | null {
  if (!isObj(x)) return null;
  const have = new Set(prompts);
  const out = Object.entries(x).flatMap(([q, a]) => {
    const t = text(a);
    return have.has(text(q)) && t && t.length <= ANSWER_MAX ? [[text(q), t]] : [];
  });
  return out.length ? Object.fromEntries(out) : null;
}

/** A final for three-line duels: a usable prompt and exactly three house lines of 1–40 characters. */
function final(x: unknown): SnarkFinal | null {
  if (!isObj(x) || !Array.isArray(x.house) || x.house.length !== 3) return null;
  const prompt = text(x.prompt);
  const house = x.house.map(text);
  if (!prompt || promptProblem(prompt) || house.some((l) => !l || l.length > LINE_MAX)) return null;
  return { prompt, house: house as SnarkFinal['house'] };
}

/** A Snark pack's optional extras; absent fields stay absent, so packs without them read back unchanged. */
function snarkExtras(raw: Record<string, unknown>, prompts: string[]): Partial<SnarkPack> {
  const stock = safety(raw.safety, prompts);
  const finals = Array.isArray(raw.finals) ? keep(raw.finals, final, (f) => f.prompt.toLowerCase()).items : [];
  return { ...(stock ? { safety: stock } : {}), ...(finals.length ? { finals } : {}) };
}

function taboo(x: unknown): TabooCard | null {
  if (!isObj(x) || typeof x.word !== 'string' || !Array.isArray(x.banned) || !x.banned.every((b) => typeof b === 'string')) return null;
  const card = tidyTaboo({ word: x.word, banned: x.banned as string[] });
  return cardProblems(card).length ? null : card;
}

/**
 * A Big Board's categories as the phone's board maker allows them: 1–8 categories of 1–10 clues,
 * every category the same length. Like a pasted board, a broken clue becomes an empty tile,
 * anything past 8 × 10 is cut off and shorter categories get empty tiles.
 */
function board(raw: unknown[]): Kept<QuizCategory> & { clues: number } {
  let skipped = 0;
  const cats: QuizCategory[] = [];
  for (const c of raw) {
    if (!isObj(c) || !Array.isArray(c.clues)) { skipped++; continue; }
    const clues = c.clues.map((k) => {
      if (isObj(k) && typeof k.clue === 'string' && typeof k.answer === 'string') return { clue: k.clue, answer: k.answer };
      skipped++;
      return { clue: '', answer: '' };
    });
    cats.push({ name: typeof c.name === 'string' ? c.name.slice(0, 40) : '', clues });
  }
  for (const c of cats.slice(MAX_CATEGORIES)) skipped += c.clues.length;
  const kept = cats.slice(0, MAX_CATEGORIES);
  for (const c of kept) skipped += Math.max(0, c.clues.length - MAX_LEVELS);
  const len = Math.min(MAX_LEVELS, Math.max(0, ...kept.map((c) => c.clues.length)));
  const items = kept.map((c) => ({ name: c.name, clues: Array.from({ length: len }, (_, r) => c.clues[r] ?? { clue: '', answer: '' }) }));
  const clues = items.reduce((n, c) => n + c.clues.filter((k) => k.clue.trim() || k.answer.trim()).length, 0);
  return { items, skipped, clues };
}

function items(game: PackGameId, raw: unknown[]): Kept<unknown> & { usable: number } {
  const done = <T>(k: Kept<T>) => ({ ...k, usable: k.items.length });
  switch (game) {
    case 'forehead': return done(keep(raw, word, (w) => w.toLowerCase()));
    case 'dial': return done(keep(raw, spectrum, spectrumId));
    case 'gibberish': return done(keep(raw, gibberish));
    case 'quick': return done(keep(raw, quick));
    case 'snark': return done(keep(raw, snark, (q) => q.toLowerCase()));
    case 'taboo': return done(keep(raw, taboo, tabooId));
    case 'quiz': { const b = board(raw); return { items: b.items, skipped: b.skipped, usable: b.clues }; }
  }
}

type ReadPack = { pack: AnyPack; skipped: number } | { problem: string };

function readPack(game: PackGameId, raw: unknown): ReadPack {
  if (!isObj(raw)) return { problem: 'One pack in the file is damaged.' };
  const name = text(raw.name).slice(0, 40) || 'My pack';
  const all = raw[FIELD[game]];
  if (!Array.isArray(all)) return { problem: `“${name}” has no ${UNIT[game]} in it.` };
  const got = items(game, all);
  if (!got.usable && got.skipped) return { problem: `None of the ${UNIT[game]} in “${name}” could be used.` };
  const base = { id: slugify(text(raw.id) || name), name, blurb: text(raw.blurb).slice(0, 80) };
  if (game === 'quiz') {
    const b = { ...base, categories: got.items as QuizCategory[] };
    const why = sizeProblem(b);
    return why ? { problem: `“${name}” cannot be played: ${why}.` } : { pack: tidyBoard(b), skipped: got.skipped };
  }
  const emoji = text(raw.emoji);
  const extra = game === 'forehead' ? { emoji: emoji && emoji.length <= 16 ? emoji : '🃏' }
    : game === 'snark' ? snarkExtras(raw, got.items as string[]) : {};
  return { pack: { ...base, ...extra, [FIELD[game]]: got.items } as unknown as AnyPack, skipped: got.skipped };
}

export interface ReadResult { packs: AnyPack[]; /** Items dropped across all packs. */ skipped: number; /** Packs left out, and why. */ problems: string[] }

/** A pack file's packs for `game`, or a plain-words reason it cannot be imported. */
export function readFile(content: string, game: PackGameId): ReadResult | { error: string } {
  if (content.length > MAX_FILE_BYTES) return { error: tooBigMessage(content.slice(0, HEAD_BYTES)) };
  const data = parseFile(content);
  return data === null ? { error: NOT_A_PACK_FILE } : readData(data, game);
}

const TOO_BIG = 'That file is too big to be a pack file.';
const retiredMessage = (name: string): string => `${name} is no longer in ${APP.name}.`;

/** How much of a file's start `tooBigMessage` needs. */
export const HEAD_BYTES = 200;

/**
 * Why a file over the size limit is refused, from its first bytes: by name when it is a pack
 * file of a game no longer in the app (an Earworm clip pack ran to 40 MB), else as too big.
 */
export function tooBigMessage(head: string): string {
  const id = /^\s*\{\s*"jerkBox"\s*:\s*\d+\s*,\s*"game"\s*:\s*"([a-z]+)"/.exec(head)?.[1];
  return id && RETIRED_GAMES[id] ? retiredMessage(RETIRED_GAMES[id]) : TOO_BIG;
}

/** The file's JSON, or null when it is not JSON at all. */
function parseFile(content: string): unknown {
  try { return JSON.parse(content); } catch { return null; }
}

/** The packs for `game` in a parsed pack file, or a plain-words reason it cannot be imported. */
function readData(data: unknown, game: PackGameId): ReadResult | { error: string } {
  if (!isObj(data) || typeof data.jerkBox !== 'number' || typeof data.game !== 'string' || !Array.isArray(data.packs)) return { error: NOT_A_PACK_FILE };
  if (data.jerkBox > FORMAT) return { error: `This pack file is from a newer ${APP.name}. Go back to the main menu, wait a moment for the update, then try again.` };
  if (data.game !== game) {
    const other = GAMES.find((g) => g.id === data.game);
    const retired = RETIRED_GAMES[data.game];
    return { error: other ? `This file is a ${other.name} pack; open ${other.name} to import it.`
      : retired ? retiredMessage(retired) : NOT_A_PACK_FILE };
  }
  if (!data.packs.length) return { error: 'This file has no packs in it.' };
  const packs: AnyPack[] = [];
  const problems: string[] = [];
  let skipped = 0;
  for (const raw of data.packs.slice(0, MAX_PACKS)) {
    const r = readPack(game, raw);
    if ('problem' in r) problems.push(r.problem);
    else { packs.push(r.pack); skipped += r.skipped; }
  }
  if (data.packs.length > MAX_PACKS) problems.push(`Only the first ${MAX_PACKS} packs were read.`);
  if (!packs.length) return { error: problems.join(' ') };
  return { packs, skipped, problems };
}

// ---- Saving on this phone

interface PackStore { saved(): AnyPack[]; put(p: AnyPack): void; isBuiltin(id: string): boolean; names(): string[] }
const STORES: Record<PackGameId, PackStore> = {
  forehead: customDecks, dial: customSpectra, gibberish: customGibberish, quiz: customQuiz,
  quick: customQuick, snark: customSnark, taboo: customTaboo,
} as Record<PackGameId, PackStore>;

/** Every pack saved on this phone for a game: the player's own and their edits of built-ins. */
export const savedPacks = (game: PackGameId): AnyPack[] => STORES[game].saved();

/** `id`, or `id-2`, `id-3`, … : the first that `taken` does not claim. */
export function freshId(id: string, taken: (id: string) => boolean): string {
  if (!taken(id)) return id;
  let n = 2;
  while (taken(`${id}-${n}`)) n++;
  return `${id}-${n}`;
}

/** `name`, or `name (2)`, `name (3)`, … : the first that `taken` does not claim (any case). */
export function freshName(name: string, taken: (lowered: string) => boolean): string {
  if (!taken(name.toLowerCase())) return name;
  let n = 2;
  while (taken(`${name} (${n})`.toLowerCase())) n++;
  return `${name} (${n})`;
}

/**
 * Saves the packs as the player's own, each under an id no built-in or saved pack uses, and a
 * name none uses either, so two tiles never look alike.
 */
export function savePacks(game: PackGameId, packs: readonly AnyPack[]): AnyPack[] {
  const store = STORES[game];
  const taken = new Set(store.saved().map((p) => p.id));
  const names = new Set(store.names().map((n) => n.toLowerCase()));
  const out = packs.map((p) => {
    const id = freshId(p.id, (x) => taken.has(x) || store.isBuiltin(x));
    const name = freshName(p.name, (x) => names.has(x));
    taken.add(id);
    names.add(name.toLowerCase());
    return { ...p, id, name };
  });
  // Each put goes on top: save the last first so the file's order is kept.
  for (const p of [...out].reverse()) store.put(p);
  return out;
}

export type ImportResult = { saved: AnyPack[]; skipped: number; problems: string[] } | { error: string };

/** Reads a pack file and saves what it holds. */
export function importPacks(game: PackGameId, content: string): ImportResult {
  const r = readFile(content, game);
  if ('error' in r) return r;
  return { saved: savePacks(game, r.packs), skipped: r.skipped, problems: r.problems };
}

/** "Imported 2 packs: Trip, Office. 12 cards skipped." */
export function importMessage(game: PackGameId, r: Exclude<ImportResult, { error: string }>): string {
  const n = r.saved.length;
  const unit = UNIT[game];
  const parts = [`Imported ${n} ${n === 1 ? 'pack' : 'packs'}: ${r.saved.map((p) => p.name).join(', ')}.`];
  if (r.skipped) parts.push(`${r.skipped} ${r.skipped === 1 ? unit.slice(0, -1) : unit} skipped.`);
  return [...parts, ...r.problems].join(' ');
}
