// What a Community library pack may hold, field by field: the wizard server rebuilds every pack
// it stores with these (worker/src/library.ts), and the phone rebuilds every pack it fetches with
// them before showing or importing it (library.ts). A pack is rebuilt from whitelisted fields of
// known types and lengths only, so nothing else (extra keys, nesting) is ever kept or walked.
// Pure (its one import is pure too), so the worker can share it.
import { isIcon } from './icon';

export const SHAPE = {
  /** Items in one pack, at most (Big Board: its tiles, at most 8 × 10 anyway). */
  itemsMax: 400,
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

export type ShapeGame = 'forehead' | 'dial' | 'gibberish' | 'quick' | 'quiz' | 'taboo' | 'snark';

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
  if (game === 'forehead') return text(x, SHAPE.word);
  if (game === 'quick' || game === 'snark') return text(x, SHAPE.phrase);
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

/** How many items a pack has: Big Board counts its written clues, the rest their items. */
export function itemCount(game: ShapeGame, items: readonly unknown[]): number {
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
 * finals (a prompt and exactly three house lines of 1–40 characters, at most 100). Anything else,
 * or broken, is left out.
 */
export function cleanExtra(game: ShapeGame, raw: unknown, items: readonly unknown[]): Record<string, unknown> {
  if (!isObj(raw)) return {};
  if (game === 'forehead') {
    return isIcon(raw.emoji) ? { emoji: raw.emoji } : {};
  }
  if (game !== 'snark') return {};
  const out: Record<string, unknown> = {};
  if (isObj(raw.safety)) {
    const prompts = new Set(items as string[]);
    const pairs = Object.entries(raw.safety).slice(0, SHAPE.itemsMax).flatMap(([q, a]) => {
      const answer = text(a, SHAPE.stockMax);
      return prompts.has(q) && answer ? [[q, answer] as const] : [];
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
