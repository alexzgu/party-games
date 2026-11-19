// "Ask Claude" for Big Board: the prompt carries the quality bar from AGENTS.md, Claude writes one
// line per clue ("Category | level | clue | answer"), easiest row first, and each line lands on
// the board the moment it arrives.
import { streamLines } from '../../lib/claude';
import type { QuizBoard } from '../../lib/content';
import { parseStreamLine, type StreamClue } from './parse';
import { MAX_CATEGORIES, MAX_LEVELS } from './board';

export const SYSTEM = `You write boards for a team quiz game that a host reads aloud at a house party. Players are adults in their 20s in the US.

A board has categories across and levels down. Level 1 is the easiest clue in its category, the last level the hardest.

Output format: one clue per line, exactly
Category | level | clue | answer
No numbering, no header, no blank lines, no commentary before or after. Use the same spelling of each category name on every line.
Write every category's level 1 first, then every category's level 2, and so on, so the board fills from the easiest row down.

Example lines (do not reuse them):
Space | 1 | This planet, fourth from the Sun, is nicknamed the Red Planet. | Mars
Space | 2 | The first person to walk on the Moon stepped down from this lander's ladder in 1969. | Neil Armstrong

Every clue must meet all of these:
1. Categories have short, fun names of 1 to 3 words, each a different angle on the topic.
2. Each column runs from easiest (level 1, something most of the room gets) to hardest (the last level, a real stretch).
3. Each clue is one or two sentences the host can read aloud in one breath, in your own words. Never copy from a quiz show or game, and no show-style framing ("This is…", answers phrased as questions).
4. Each clue has exactly one right answer, short (1 to 5 words).
5. The answer is never named or spelled out in its own clue or in another clue of the same category.
6. Check every fact. Leave out anything you are not sure of or that may have changed recently.
7. Never repeat a clue or an answer anywhere on the board.`;

export function buildPrompt(topic: string, cats: number, levels: number): string {
  const t = topic.trim() || 'a mix of everything';
  return `Topic: ${t}\nWrite a board of ${cats} ${cats === 1 ? 'category' : 'categories'} with ${levels} ${levels === 1 ? 'level' : 'levels'} each: ${cats * levels} lines in all, levels numbered 1 to ${levels}.`;
}

const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const words = (s: string) => key(s).split(/[^a-z0-9]+/).filter((w) => w.length > 2);

/** True when the clue names its own answer (every longer word of the answer appears in it). */
export function givesAway(clue: string, answer: string): boolean {
  const a = words(answer.replace(/^the\s+/i, ''));
  if (!a.length) return key(clue).includes(key(answer));
  const c = new Set(words(clue));
  return a.every((w) => c.has(w));
}

/**
 * Places one streamed clue on a board being built to `cats` × `levels`, or returns the same board
 * when the line has no place: a category past the count, a level off the board, a tile already
 * filled, a repeated clue or answer, or a clue that gives its answer away.
 */
export function placeClue(b: QuizBoard, s: StreamClue, cats: number, levels: number): QuizBoard {
  if (s.level > levels) return b;
  const all = b.categories.flatMap((c) => c.clues).filter((k) => k.clue);
  if (all.some((k) => key(k.clue) === key(s.clue) || key(k.answer) === key(s.answer)) || givesAway(s.clue, s.answer)) return b;
  let ci = b.categories.findIndex((c) => key(c.name) === key(s.category));
  let categories = b.categories;
  if (ci < 0) {
    // A blank column ("Category 3" before any of its lines arrived) takes the new name.
    ci = categories.findIndex((c) => c.clues.every((k) => !k.clue));
    if (ci < 0 && categories.length >= cats) return b;
    if (ci < 0) categories = [...categories, { name: s.category, clues: Array.from({ length: levels }, () => ({ clue: '', answer: '' })) }];
    ci = ci < 0 ? categories.length - 1 : ci;
    categories = categories.map((c, i) => (i === ci ? { ...c, name: s.category } : c));
  }
  if (categories[ci].clues[s.level - 1]?.clue) return b;
  return {
    ...b,
    categories: categories.map((c, i) => (i !== ci ? c : { ...c, clues: c.clues.map((k, r) => (r === s.level - 1 ? { clue: s.clue, answer: s.answer } : k)) })),
  };
}

/** An empty board of the asked size, named for the topic, for the stream to fill. */
export function emptyBoardFor(topic: string, cats: number, levels: number): QuizBoard {
  const name = topic.trim().replace(/\s+/g, ' ').replace(/^\w/, (c) => c.toUpperCase()).slice(0, 40) || 'My board';
  return {
    id: '', name, blurb: `Made with Claude: ${topic.trim() || name}`,
    categories: Array.from({ length: cats }, (_, i) => ({ name: `Category ${i + 1}`, clues: Array.from({ length: levels }, () => ({ clue: '', answer: '' })) })),
  };
}

/** Streams a board for a topic; `onBoard` gets the board after every clue that lands. */
export async function generateBoard(opts: {
  topic: string;
  cats: number;
  levels: number;
  onBoard: (b: QuizBoard) => void;
  signal?: AbortSignal;
}): Promise<QuizBoard> {
  const cats = Math.min(MAX_CATEGORIES, Math.max(1, opts.cats));
  const levels = Math.min(MAX_LEVELS, Math.max(1, opts.levels));
  let board = emptyBoardFor(opts.topic, cats, levels);
  await streamLines({
    system: SYSTEM,
    prompt: buildPrompt(opts.topic, cats, levels),
    signal: opts.signal,
    maxTokens: Math.max(4000, 600 + cats * levels * 100),
    onLine: (line) => {
      const s = parseStreamLine(line);
      if (!s) return;
      const next = placeClue(board, s, cats, levels);
      if (next === board) return;
      board = next;
      opts.onBoard(board);
    },
  });
  return board;
}
