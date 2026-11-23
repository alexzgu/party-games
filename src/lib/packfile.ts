// Pack files: packs saved to a file to keep or send to friends, and read back in on any phone.
// A file is {"jerkBox": 1, "game": "<game id>", "packs": [...]}, each pack in its stored shape
// without the fields that only mean something on one phone (custom, added). Reading a file
// checks every item with that game's own rules (the ones its pack editor or paste route uses),
// drops the items that fail with a count, and saves each pack as the player's own under an id
// nothing on the phone uses yet, so an import never overwrites a pack.
import { APP, gameName, GAMES, RETIRED_GAMES, type PackGameId } from '../app.config';
import {
  customBrawl, customDecks, customGibberish, customHand, customQuick, customQuiz, customSketch, customSnark, customSpectra, customTaboo, slugify,
  type BrawlPack, type GibberishCard, type HandPack, type SketchPack, type GibberishPack, type QuickPack, type QuizBoard, type QuizCategory, type SnarkPack,
  type Spectrum, type SpectrumPack, type TabooCard, type TabooPack, type WordDeck,
} from './content';
import { MAX_ITEM_CHARS, MAX_WORDS_PER_ITEM } from '../games/forehead/words';
import { DEFAULT_ICON, oneIcon } from './icon';
import { parsePair } from '../games/dial/generate';
import { cardId as spectrumId } from '../games/dial/state';
import { checkCard } from '../games/gibberish/parse';
import { MAX_CATEGORIES, MAX_LEVELS, sizeProblem, tidyBoard } from '../games/quiz/board';
import { cleanPrompt, promptError } from '../games/quick/parse';
import { promptProblem } from '../games/snark/prompts';
import { readFinals } from '../games/snark/finals';
import { ANSWER_MAX } from '../games/snark/logic';
import { cardId as tabooId, cardProblems, tidy as tidyTaboo } from '../games/taboo/cards';
import { checked, type ListSpec } from './listSpec';
import { freshId, freshName, partCount, splitPack } from './splitPack';
import { newPid as randomId } from './room/code';
import { SHAPE } from './libraryShape';

export { freshId, freshName };
import { BRAWL_LISTS } from '../games/brawl/rules';
import { HAND_LISTS } from '../games/hand/rules';
import { SKETCH_LISTS } from '../games/sketch/rules';

export const FORMAT = 1;
export const MAX_FILE_BYTES = 1_000_000;
/** Limits of the file format, well above any pack made so far. */
export const MAX_PACKS = 100;
export const MAX_ITEMS = 1000;

export type AnyPack = WordDeck | SpectrumPack | GibberishPack | QuizBoard | QuickPack | SnarkPack | TabooPack | BrawlPack | SketchPack | HandPack;
type Field = 'words' | 'cards' | 'categories' | 'prompts' | 'titles' | 'answers' | 'ideas';

/** Games whose packs are plain text lists, checked by their specs (listPack.ts). */
const LIST_SPECS: Partial<Record<PackGameId, readonly ListSpec[]>> = { brawl: BRAWL_LISTS, hand: HAND_LISTS, sketch: SKETCH_LISTS };

/**
 * Each game's item lists, the main one first: what the Community library calls a pack's items.
 * Bad Hand's answers and Sketchy's ideas go beside them (`packParts` extra).
 */
const LISTS: Record<PackGameId, readonly Field[]> = {
  forehead: ['words'], dial: ['cards'], gibberish: ['cards'], quiz: ['categories'], quick: ['prompts'], snark: ['prompts'], taboo: ['cards'],
  brawl: ['titles'], hand: ['prompts', 'answers'], sketch: ['words', 'ideas'],
};
const FIELD = (game: PackGameId): Field => LISTS[game][0];
/** What the items are called on screen, plural (all of a pack's lists together). */
const UNIT: Record<PackGameId, string> = {
  forehead: 'words', dial: 'cards', gibberish: 'cards', quiz: 'clues', quick: 'prompts', snark: 'prompts', taboo: 'cards',
  brawl: 'titles', hand: 'cards', sketch: 'items',
};

/** What a game's items are called on screen: plural, and one of them ("words", "word"). */
export const unitOf = (game: PackGameId, n = 2): string => (n === 1 ? UNIT[game].slice(0, -1) : UNIT[game]);

const NOT_A_PACK_FILE = `This isn't a ${APP.name} pack file.`;

// ---- Writing

/**
 * The pack as it goes in a file: id, name, emoji (Heads Down. only), blurb and items (Snark Tank:
 * stock answers and finals too, when it has them; Bad Hand and Sketchy: both their lists).
 */
function plain(game: PackGameId, p: AnyPack): Record<string, unknown> {
  const { safety, finals } = game === 'snark' ? (p as SnarkPack) : {};
  const lists = Object.fromEntries(LISTS[game].map((f) => [f, (p as unknown as Record<Field, unknown>)[f] ?? []]));
  return {
    id: p.id, name: p.name, ...(game === 'forehead' ? { emoji: (p as WordDeck).emoji } : {}), blurb: p.blurb,
    ...lists, ...(safety ? { safety } : {}), ...(finals ? { finals } : {}),
  };
}

/** The name of a game's (main) items field in a pack ('words', 'cards', …). */
export const itemsField = (game: PackGameId): Field => FIELD(game);

/** Every item list of a game's packs, the main one first (Bad Hand: prompts, answers). */
export const listFields = (game: PackGameId): readonly Field[] => LISTS[game];

/**
 * A pack's (main) items, and the fields beside them a file keeps (emoji; Snark Tank's stock
 * answers and finals; Bad Hand's answers, Sketchy's ideas).
 */
export function packParts(game: PackGameId, p: AnyPack): { items: unknown[]; extra: Record<string, unknown> } {
  const { [FIELD(game)]: items, id: _id, name: _name, blurb: _blurb, ...extra } = plain(game, p);
  return { items: items as unknown[], extra };
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

/** A Snark pack's optional extras; absent fields stay absent, so packs without them read back unchanged. */
function snarkExtras(raw: Record<string, unknown>, prompts: string[]): Partial<SnarkPack> {
  const stock = safety(raw.safety, prompts);
  const finals = Array.isArray(raw.finals) ? readFinals(raw.finals.slice(0, MAX_ITEMS)).finals : [];
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

function items(game: PackGameId, raw: unknown[], field: Field): Kept<unknown> & { usable: number } {
  const done = <T>(k: Kept<T>) => ({ ...k, usable: k.items.length });
  const spec = LIST_SPECS[game]?.find((s) => s.field === field);
  if (spec) return done(keep(raw, (x) => checked(spec, x), spec.key));
  switch (game) {
    case 'forehead': return done(keep(raw, word, (w) => w.toLowerCase()));
    case 'dial': return done(keep(raw, spectrum, spectrumId));
    case 'gibberish': return done(keep(raw, gibberish));
    case 'quick': return done(keep(raw, quick));
    case 'snark': return done(keep(raw, snark, (q) => q.toLowerCase()));
    case 'taboo': return done(keep(raw, taboo, tabooId));
    case 'quiz': { const b = board(raw); return { items: b.items, skipped: b.skipped, usable: b.clues }; }
    default: return { items: [], skipped: raw.length, usable: 0 };
  }
}

type ReadPack = { pack: AnyPack; skipped: number } | { problem: string };

function readPack(game: PackGameId, raw: unknown): ReadPack {
  if (!isObj(raw)) return { problem: 'One pack in the file is damaged.' };
  const name = text(raw.name).slice(0, 40) || 'My pack';
  // A two-list pack may leave one list out (a Sketchy pack of ideas only); never every list.
  const fields = LISTS[game];
  if (!fields.some((f) => Array.isArray(raw[f]))) return { problem: `“${name}” has no ${UNIT[game]} in it.` };
  const lists = fields.map((f) => items(game, Array.isArray(raw[f]) ? raw[f] : [], f));
  const got = { usable: lists.reduce((n, l) => n + l.usable, 0), skipped: lists.reduce((n, l) => n + l.skipped, 0) };
  if (!got.usable && got.skipped) return { problem: `None of the ${UNIT[game]} in “${name}” could be used.` };
  const base = { id: slugify(text(raw.id) || name), name, blurb: text(raw.blurb).slice(0, 80) };
  const fieldsRead = Object.fromEntries(fields.map((f, i) => [f, lists[i].items]));
  if (game === 'quiz') {
    const b = { ...base, categories: lists[0].items as QuizCategory[] };
    const why = sizeProblem(b);
    return why ? { problem: `“${name}” cannot be played: ${why}.` } : { pack: tidyBoard(b), skipped: got.skipped };
  }
  // Any one character is an icon (older files have one of the 14 the picker used to offer).
  const extra = game === 'forehead' ? { emoji: oneIcon(text(raw.emoji)) || DEFAULT_ICON }
    : game === 'snark' ? snarkExtras(raw, lists[0].items as string[]) : {};
  return { pack: { ...base, ...extra, ...fieldsRead } as unknown as AnyPack, skipped: got.skipped };
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

interface PackStore { saved(): AnyPack[]; putAll(p: readonly AnyPack[]): boolean; markShared(id: string): boolean; isBuiltin(id: string): boolean; names(): string[]; builtins(): readonly AnyPack[] }
const STORES: Record<PackGameId, PackStore> = {
  forehead: customDecks, dial: customSpectra, gibberish: customGibberish, quiz: customQuiz,
  quick: customQuick, snark: customSnark, taboo: customTaboo, brawl: customBrawl, hand: customHand, sketch: customSketch,
} as Record<PackGameId, PackStore>;

/** Every pack saved on this phone for a game: the player's own and their edits of built-ins. */
export const savedPacks = (game: PackGameId): AnyPack[] => STORES[game].saved();

/** The player's own pack as saved on this phone (never a built-in or its edit), or undefined. */
export const ownPack = (game: PackGameId, id: string): AnyPack | undefined =>
  STORES[game].isBuiltin(id) ? undefined : STORES[game].saved().find((p) => p.id === id);

/** Marks the player's own saved pack as shared, changing nothing else; false when it is gone. */
export const markPackShared = (game: PackGameId, id: string): boolean => STORES[game].markShared(id);

/** True for a built-in pack's id (an edit of one is saved under it). */
export const isBuiltinPack = (game: PackGameId, id: string): boolean => STORES[game].isBuiltin(id);

/** A game's built-in packs as shipped. */
export const builtinPacks = (game: PackGameId): readonly AnyPack[] => STORES[game].builtins();

/**
 * Names for new packs of the player's own that nothing uses: no built-in or saved pack, and no
 * other name given out here (nor `own`, saved yet or not). A split-off part (`part`) gets a random id: no pack
 * deleted or shared before, in any tab, ever had it, so sharing it never replaces another's entry.
 */
function namer(game: PackGameId, own?: AnyPack) {
  const store = STORES[game];
  const ids = new Set([...store.saved(), ...(own ? [own] : [])].map((p) => p.id));
  const names = new Set([...store.names(), ...(own ? [own.name] : [])].map((n) => n.toLowerCase()));
  return (p: { id: string; name: string }, part = false): { id: string; name: string } => {
    const id = part ? `${p.id}-${randomId()}` : freshId(p.id, (x) => ids.has(x) || store.isBuiltin(x));
    const name = freshName(p.name, (x) => names.has(x));
    ids.add(id);
    names.add(name.toLowerCase());
    return { id, name };
  };
}

const fieldsOf = (game: PackGameId): readonly string[] => (LIST_SPECS[game] ?? []).map((s) => s.field);

/** True when a list pack has a list too long for one pack (the Community library's limit). */
export const tooLong = (game: PackGameId, pack: object): boolean => partCount(pack, fieldsOf(game), SHAPE.itemsMax) > 1;

/** What a save that found no room says. */
export const NO_ROOM = 'There is no room left on this device to save that. Nothing was changed.';

/**
 * Saves the player's own list pack under its own id, as several packs when it is too long for one:
 * all of them, or none (an empty list) when there is no room.
 */
export function putSplit<P extends object>(game: PackGameId, pack: P): P[] {
  const own = pack as unknown as AnyPack;
  const fresh = namer(game, own);
  const parts = splitPack(own, fieldsOf(game), SHAPE.itemsMax, () => fresh(own, true));
  return STORES[game].putAll(parts) ? (parts as unknown as P[]) : [];
}

/**
 * Saves the packs as the player's own, each under an id no built-in or saved pack uses, and a
 * name none uses either, so two tiles never look alike; one too long is saved as several. All of
 * them, or none (an empty list) when there is no room.
 */
export function savePacks(game: PackGameId, packs: readonly AnyPack[]): AnyPack[] {
  const fresh = namer(game);
  const out = packs.flatMap((p) => splitPack({ ...p, ...fresh(p) }, fieldsOf(game), SHAPE.itemsMax, () => fresh(p, true)));
  return STORES[game].putAll(out) ? out : [];
}

export type ImportResult = { saved: AnyPack[]; skipped: number; problems: string[] } | { error: string };

/** Reads a pack file and saves what it holds. */
export function importPacks(game: PackGameId, content: string): ImportResult {
  const r = readFile(content, game);
  if ('error' in r) return r;
  const saved = savePacks(game, r.packs);
  return saved.length ? { saved, skipped: r.skipped, problems: r.problems } : { error: NO_ROOM };
}

/** "Imported 2 packs: Trip, Office. 12 cards skipped." */
export function importMessage(game: PackGameId, r: Exclude<ImportResult, { error: string }>): string {
  const n = r.saved.length;
  const unit = UNIT[game];
  const parts = [`Imported ${n} ${n === 1 ? 'pack' : 'packs'}: ${r.saved.map((p) => p.name).join(', ')}.`];
  if (r.skipped) parts.push(`${r.skipped} ${r.skipped === 1 ? unit.slice(0, -1) : unit} skipped.`);
  return [...parts, ...r.problems].join(' ');
}
