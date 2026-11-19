// Boards as the board maker sees them: size limits, empty tiles, and every edit the editor makes.
// Each edit returns a new board with every category the same length, so a board can never be
// left uneven. Built-in boards in the repo stay 3–6 × 3–5 (the content gate); on the phone a
// board may be 1–8 categories × 1–10 levels.
import type { QuizBoard, QuizCategory, QuizClue } from '../../lib/content';

export const MAX_CATEGORIES = 8;
export const MAX_LEVELS = 10;
export const DEFAULT_CATEGORIES = 5;
export const DEFAULT_LEVELS = 5;

/** Clues per category (the board's height). */
export const levels = (b: Pick<QuizBoard, 'categories'>) => b.categories[0]?.clues.length ?? 0;

const blankClue = (): QuizClue => ({ clue: '', answer: '' });
const blankCategory = (n: number, len: number): QuizCategory => ({ name: `Category ${n}`, clues: Array.from({ length: len }, blankClue) });

/** Why a board's shape cannot be played, or '' when it can. */
export function sizeProblem(b: Pick<QuizBoard, 'categories'>): string {
  const cats = b.categories.length;
  const len = levels(b);
  if (cats < 1 || cats > MAX_CATEGORIES) return `${cats} categories (1–${MAX_CATEGORIES} allowed)`;
  if (len < 1 || len > MAX_LEVELS) return `${len} levels (1–${MAX_LEVELS} allowed)`;
  if (b.categories.some((c) => c.clues.length !== len)) return 'categories of different lengths';
  return '';
}

export interface EmptyTile { category: number; level: number; /** What is missing. */ missing: 'clue' | 'answer' | 'both' }

/** Every tile still missing its clue or answer, category by category, top to bottom. */
export function emptyTiles(b: Pick<QuizBoard, 'categories'>): EmptyTile[] {
  return b.categories.flatMap((c, category) =>
    c.clues.flatMap((k, level): EmptyTile[] => {
      const clue = !k.clue.trim();
      const answer = !k.answer.trim();
      return clue || answer ? [{ category, level, missing: clue && answer ? 'both' : clue ? 'clue' : 'answer' }] : [];
    }),
  );
}

/** "Movies 300, Music 100 (answer) and 4 more": which tiles to fill, for setup. */
export function describeEmpty(b: Pick<QuizBoard, 'categories'>, values?: number[], shown = 3): string {
  const empties = emptyTiles(b);
  const value = (level: number) => values?.[level] ?? (level + 1) * 100;
  const label = (e: EmptyTile) => `${b.categories[e.category].name} ${value(e.level)}${e.missing === 'both' ? '' : ` (${e.missing})`}`;
  const head = empties.slice(0, shown).map(label);
  const more = empties.length - head.length;
  if (more > 0) return `${head.join(', ')} and ${more} more`;
  return head.length < 2 ? head.join('') : `${head.slice(0, -1).join(', ')} and ${head.at(-1)}`;
}

/** A board of empty tiles to fill in: "Category 1", "Category 2", … */
export function blankBoard(name: string, cats = DEFAULT_CATEGORIES, len = DEFAULT_LEVELS): QuizBoard {
  const c = Math.min(MAX_CATEGORIES, Math.max(1, cats));
  const l = Math.min(MAX_LEVELS, Math.max(1, len));
  return { id: '', name: name.trim() || 'My board', blurb: 'Made on this phone', categories: Array.from({ length: c }, (_, i) => blankCategory(i + 1, l)) };
}

// ---- Edits. Each returns the same board when the edit is not allowed (size limits, bad index).

const withCats = (b: QuizBoard, categories: QuizCategory[]): QuizBoard => ({ ...b, categories });

/** The name as typed (it may be blank mid-edit; tidyBoard names a blank category when saved or played). */
export function renameCategory(b: QuizBoard, ci: number, name: string): QuizBoard {
  if (!b.categories[ci]) return b;
  return withCats(b, b.categories.map((c, i) => (i === ci ? { ...c, name: name.slice(0, 40) } : c)));
}

/** A new category at the end, as tall as the others. */
export function addCategory(b: QuizBoard): QuizBoard {
  if (b.categories.length >= MAX_CATEGORIES) return b;
  return withCats(b, [...b.categories, blankCategory(b.categories.length + 1, Math.max(1, levels(b)))]);
}

export function removeCategory(b: QuizBoard, ci: number): QuizBoard {
  if (b.categories.length <= 1 || !b.categories[ci]) return b;
  return withCats(b, b.categories.filter((_, i) => i !== ci));
}

/** Moves a category one place left (-1) or right (+1). */
export function moveCategory(b: QuizBoard, ci: number, dir: -1 | 1): QuizBoard {
  const to = ci + dir;
  if (!b.categories[ci] || !b.categories[to]) return b;
  const cats = b.categories.slice();
  [cats[ci], cats[to]] = [cats[to], cats[ci]];
  return withCats(b, cats);
}

/** A new, hardest level at the bottom of every category. */
export function addLevel(b: QuizBoard): QuizBoard {
  if (levels(b) >= MAX_LEVELS) return b;
  return withCats(b, b.categories.map((c) => ({ ...c, clues: [...c.clues, blankClue()] })));
}

/** Drops one level (row) from every category, so they stay the same length. */
export function removeLevel(b: QuizBoard, level: number): QuizBoard {
  if (levels(b) <= 1 || level < 0 || level >= levels(b)) return b;
  return withCats(b, b.categories.map((c) => ({ ...c, clues: c.clues.filter((_, r) => r !== level) })));
}

/** How many filled-in clues or answers removing this level would lose. */
export const levelContent = (b: QuizBoard, level: number) =>
  b.categories.filter((c) => c.clues[level] && (c.clues[level].clue.trim() || c.clues[level].answer.trim())).length;

export function setClue(b: QuizBoard, ci: number, level: number, patch: Partial<QuizClue>): QuizBoard {
  if (!b.categories[ci]?.clues[level]) return b;
  return withCats(b, b.categories.map((c, i) => (i !== ci ? c : { ...c, clues: c.clues.map((k, r) => (r === level ? { ...k, ...patch } : k)) })));
}

/** A board as saved: names and text trimmed, the `custom` flag left to the store. */
export function tidyBoard(b: QuizBoard): QuizBoard {
  const { custom: _, ...rest } = b;
  return {
    ...rest,
    name: b.name.trim().replace(/\s+/g, ' ') || 'My board',
    blurb: b.blurb.trim(),
    categories: b.categories.map((c, i) => ({
      name: c.name.trim() || `Category ${i + 1}`,
      clues: c.clues.map((k) => ({ clue: k.clue.trim(), answer: k.answer.trim() })),
    })),
  };
}
