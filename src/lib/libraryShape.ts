// What a Community library pack may hold, field by field: the wizard server rebuilds every pack
// it stores with these (worker/src/library.ts), and the phone rebuilds every pack it fetches with
// them before showing or importing it (library.ts). A pack is rebuilt from whitelisted fields of
// known types and lengths only, so nothing else (extra keys, nesting) is ever kept or walked.
// Pure (its one import is pure too), so the worker can share it.
import { isIcon } from './icon';
import { checked, type ListSpec } from './listSpec';
import { BRAWL_LISTS } from '../games/brawl/rules';
import { HAND_LISTS } from '../games/hand/rules';
import { SKETCH_LISTS } from '../games/sketch/rules';

export const SHAPE = {
  /** Items in one list of a pack, at most (Bad Hand and Sketchy have two lists; Big Board: its tiles, at most 8 × 10 anyway). */
  itemsMax: 400,
  /** A pack's items and the fields beside them as JSON, in bytes, at most (the server's LIBRARY.itemsBytes). */
  bytesMax: 64 * 1024,
  quizCategories: 8,
  quizClues: 10,
  tabooBanned: 10,
  snarkFinals: 100,
  stockMax: 80,
  houseMax: 40,
  /** Characters in one field, by what it is. */
  word: 80,
  phrase: 200,
  hint: 60,
  categoryName: 60,
  clue: 600,
  answer: 200,
};

export type ShapeGame = 'forehead' | 'dial' | 'gibberish' | 'quick' | 'quiz' | 'taboo' | 'snark' | 'brawl' | 'hand' | 'sketch';

/** Two-list games: the second list, beside the items (Bad Hand: prompts are the items, answers beside). */
const SECOND: Partial<Record<ShapeGame, { field: string; max: number }>> = {
  hand: { field: 'answers', max: SHAPE.phrase },
  sketch: { field: 'ideas', max: SHAPE.phrase },
};

/** Games whose items keep their own rules in the library too (each list's, the main one first). */
const SPECS: Partial<Record<ShapeGame, readonly ListSpec[]>> = { brawl: BRAWL_LISTS, hand: HAND_LISTS, sketch: SKETCH_LISTS };

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/** A string trimmed, spaces collapsed, of 1 to `max` characters (0 to `max` with `blank`), else null. */
export function text(x: unknown, max: number, blank = false): string | null {
  if (typeof x !== 'string' || x.length > max * 4) return null;
  const t = x.trim().replace(/\s+/g, ' ');
  return t.length <= max && (blank || t.length > 0) ? t : null;
}

type Item = string | Record<string, unknown>;

/** One item rebuilt with only its game's fields, or null when it does not fit. */
function item(game: ShapeGame, x: unknown): Item | null {
  if (game === 'forehead' || game === 'sketch') return text(x, SHAPE.word);
  if (game === 'quick' || game === 'snark' || game === 'brawl' || game === 'hand') return text(x, SHAPE.phrase);
  if (!isObj(x)) return null;
  if (game === 'dial') {
    const left = text(x.left, SHAPE.word), right = text(x.right, SHAPE.word);
    return left && right ? { left, right } : null;
  }
  if (game === 'gibberish') {
    const phrase = text(x.phrase, SHAPE.phrase), answer = text(x.answer, SHAPE.phrase);
    const hint = x.hint === undefined ? '' : text(x.hint, SHAPE.hint, true);
    return phrase && answer && hint !== null ? { phrase, answer, hint } : null;
  }
  if (game === 'taboo') {
    const word = text(x.word, SHAPE.word);
    if (!word || !Array.isArray(x.banned) || !x.banned.length || x.banned.length > SHAPE.tabooBanned) return null;
    const banned = x.banned.map((b) => text(b, SHAPE.word));
    return banned.every((b) => b !== null) ? { word, banned: banned as string[] } : null;
  }
  // quiz: a category of 1–10 clues, blank tiles allowed.
  const name = text(x.name, SHAPE.categoryName, true);
  if (name === null || !Array.isArray(x.clues) || !x.clues.length || x.clues.length > SHAPE.quizClues) return null;
  const clues = x.clues.map((k) => {
    if (!isObj(k)) return null;
    const clue = text(k.clue, SHAPE.clue, true), answer = text(k.answer, SHAPE.answer, true);
    return clue !== null && answer !== null ? { clue, answer } : null;
  });
  return clues.every((k) => k !== null) ? { name, clues } : null;
}

/**
 * How many items a pack has: Big Board counts its written clues, Bad Hand and Sketchy both their
 * lists (`extra` as `cleanExtra` made it), the rest their items.
 */
export function itemCount(game: ShapeGame, items: readonly unknown[], extra: Record<string, unknown> = {}): number {
  const second = SECOND[game];
  if (second) return items.length + (Array.isArray(extra[second.field]) ? (extra[second.field] as unknown[]).length : 0);
  if (game !== 'quiz') return items.length;
  return items.reduce<number>((n, c) => n + (c as { clues: { clue: string }[] }).clues.filter((k) => k.clue).length, 0);
}

/** The pack's items rebuilt, or why not; at least one, and within the caps. */
export function cleanItems(game: ShapeGame, raw: unknown): { items: Item[] } | { problem: string } {
  const max = game === 'quiz' ? SHAPE.quizCategories : SHAPE.itemsMax;
  if (!Array.isArray(raw) || !raw.length) return { problem: 'items must be a list with something in it.' };
  if (raw.length > max) return { problem: `A pack holds at most ${max} ${game === 'quiz' ? 'categories' : 'items'}.` };
  const items = raw.map((x) => item(game, x));
  if (!items.every((x) => x !== null)) return { problem: `Some items are not ${game} items.` };
  if (itemCount(game, items as Item[]) < 1) return { problem: 'A pack needs at least one written item.' };
  return { items: items as Item[] };
}

/**
 * The fields beside the items a game keeps, rebuilt: a Heads Down. icon (exactly one character,
 * icon.ts); a Snark Tank pack's stock answers (only for its own prompts, 1–80 characters) and
 * finals (a prompt and exactly three house lines of 1–40 characters, at most 100); Bad Hand's
 * answers and Sketchy's ideas (texts of 1–200 characters, at most 400; broken ones left out).
 * Anything else, or broken, is left out.
 */
export function cleanExtra(game: ShapeGame, raw: unknown, items: readonly unknown[]): Record<string, unknown> {
  if (!isObj(raw)) return {};
  if (game === 'forehead') {
    return isIcon(raw.emoji) ? { emoji: raw.emoji } : {};
  }
  const second = SECOND[game];
  if (second) {
    const list = Array.isArray(raw[second.field]) ? (raw[second.field] as unknown[]).slice(0, SHAPE.itemsMax).map((x) => text(x, second.max)).filter((x) => x !== null) : [];
    return list.length ? { [second.field]: list } : {};
  }
  if (game !== 'snark') return {};
  const out: Record<string, unknown> = {};
  if (isObj(raw.safety)) {
    const prompts = new Set(items as string[]);
    const pairs = Object.entries(raw.safety).map(([q, a]) => [text(q, SHAPE.phrase) ?? '', a] as const).filter(([q]) => prompts.has(q)).slice(0, SHAPE.itemsMax).flatMap(([q, a]) => {
      const answer = text(a, SHAPE.stockMax);
      return answer ? [[q, answer] as const] : [];
    });
    // fromEntries makes own properties, so even a prompt named "__proto__" stays plain data.
    if (pairs.length) out.safety = Object.fromEntries(pairs);
  }
  if (Array.isArray(raw.finals)) {
    const finals = raw.finals.slice(0, SHAPE.snarkFinals).flatMap((f) => {
      if (!isObj(f) || !Array.isArray(f.house) || f.house.length !== 3) return [];
      const prompt = text(f.prompt, SHAPE.phrase);
      const house = f.house.map((l) => text(l, SHAPE.houseMax));
      return prompt && house.every((l) => l !== null) ? [{ prompt, house }] : [];
    });
    if (finals.length) out.finals = finals;
  }
  return out;
}

/**
 * A pack as the library stores it, or why it cannot. For the games in `SPECS` every item of every
 * list must be one the game itself takes (what an import keeps), no list may be too long or repeat
 * an item, and what is stored is exactly what was checked; nothing is ever left out. The phone
 * asks this before it sends, the server before it stores.
 */
export function cleanPublish(game: ShapeGame, rawItems: unknown, rawExtra: unknown): { items: Item[]; extra: Record<string, unknown> } | { problem: string } {
  const c = cleanItems(game, rawItems);
  if ('problem' in c) return c;
  const specs = SPECS[game];
  if (!specs) {
    const extra = cleanExtra(game, rawExtra, c.items);
    return game === 'snark' && extrasIn(rawExtra, c.items) !== extrasIn(extra, c.items)
      ? { problem: 'Some stock answers or finals are not ones the game takes.' } : { items: c.items, extra };
  }
  const lists: string[][] = [];
  for (const [n, spec] of specs.entries()) {
    const raw = n === 0 ? rawItems : isObj(rawExtra) ? rawExtra[spec.field] : undefined;
    const list = raw === undefined ? [] : cleanList(spec, raw);
    if ('problem' in list) return list;
    lists.push(list);
  }
  return { items: lists[0], extra: lists[1]?.length ? { [specs[1].field]: lists[1] } : {} };
}

/** How many stock answers (written ones, of the pack's own prompts) and finals a Snark Tank pack carries. */
function extrasIn(extra: unknown, prompts: readonly unknown[]): number {
  if (!isObj(extra)) return 0;
  const have = new Set(prompts);
  // A prompt is known by its text as stored (spaces collapsed); an answer left blank is none.
  const written = (a: unknown) => typeof a !== 'string' || a.trim() !== '';
  const stock = isObj(extra.safety) ? new Set(Object.entries(extra.safety).filter(([q, a]) => have.has(text(q, SHAPE.phrase)) && written(a)).map(([q]) => text(q, SHAPE.phrase))).size : 0;
  return stock + (Array.isArray(extra.finals) ? extra.finals.length : 0);
}

function cleanList(spec: ListSpec, raw: unknown): string[] | { problem: string } {
  if (!Array.isArray(raw)) return { problem: `${spec.many} must be a list.` };
  if (raw.length > SHAPE.itemsMax) return { problem: `A pack holds at most ${SHAPE.itemsMax} ${spec.many}.` };
  // Length first: nothing long is ever tidied.
  const list = raw.map((x) => (typeof x === 'string' && x.length <= spec.max ? checked(spec, x) : null));
  if (!list.every((x) => x !== null)) return { problem: `Some ${spec.many} are not ones the game takes.` };
  if (new Set(list.map((x) => spec.key(x as string))).size < list.length) return { problem: `Some ${spec.many} are in the pack twice.` };
  return list as string[];
}
