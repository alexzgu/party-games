// "🧙 Add more" on a Big Board pack: Fizzwick writes one new category (as tall as the others) or
// one new, hardest level (a clue for every category). Lines come as "Category | level | clue |
// answer"; each is checked like a made board's (no repeated clue or answer, no giveaway) and must
// fit the one new slot it fills.
import { morePrompt, streamMore, type MoreRun } from '../../lib/addMore';
import type { QuizBoard } from '../../lib/content';
import * as edit from './board';
import { givesAway, key, SYSTEM } from './generate';
import { parseStreamLine, type StreamClue } from './parse';

export type MoreShape = 'category' | 'level';

/** The shapes the board still has room for. */
export function moreShapes(b: QuizBoard): MoreShape[] {
  const out: MoreShape[] = [];
  if (b.categories.length < edit.MAX_CATEGORIES) out.push('category');
  if (edit.levels(b) < edit.MAX_LEVELS) out.push('level');
  return out;
}

/** How many clues a shape adds: one per level, or one per category. */
export const slotsFor = (b: QuizBoard, shape: MoreShape) => (shape === 'category' ? edit.levels(b) : b.categories.length);

/** Where a new clue goes, unique within one ask: its level (new category) or its category (new level). */
export const slotKey = (s: StreamClue) => `${s.level}|${key(s.category)}`;

const filled = (b: QuizBoard) => b.categories.flatMap((c) => c.clues.map((k, r) => ({ category: c.name, level: r + 1, ...k }))).filter((k) => k.clue.trim());

export function buildMorePrompt(b: QuizBoard, shape: MoreShape, steer: string): string {
  const len = edit.levels(b);
  const names = b.categories.map((c) => c.name.trim());
  const have = filled(b).map((k) => `${k.category} | ${k.level} | ${k.clue} | ${k.answer}`);
  const base = morePrompt({ name: b.name, blurb: b.blurb, have }, { count: 1, steer }, shape === 'category' ? 'category' : 'level');
  const ask = shape === 'category'
    ? `The new category has ${len} ${len === 1 ? 'level' : 'levels'}: ${len} lines, levels numbered 1 to ${len}, all with the same new category name. It is a different angle on the topic from the categories already on the board: ${names.join('; ')}.`
    : `The new level is level ${len + 1}, harder than every clue on the board now: exactly one line for each of these categories, spelled as here: ${names.join('; ')}.`;
  return `${base}\n\n${ask}`;
}

/**
 * A reader for streamed lines: each usable line becomes the clue for one free slot of the shape,
 * or null. `taken` are the clues already written this time, which it counts as placed.
 */
export function moreReader(b: QuizBoard, shape: MoreShape, taken: readonly StreamClue[]): (line: string) => StreamClue | null {
  const placed = [...taken];
  const len = edit.levels(b);
  const used = (s: StreamClue) => [...filled(b), ...placed].some((k) => key(k.clue) === key(s.clue) || key(k.answer) === key(s.answer));
  const fit = (s: StreamClue): StreamClue | null => {
    if (shape === 'level') {
      const cat = b.categories.find((c) => key(c.name) === key(s.category));
      return cat ? { ...s, category: cat.name, level: len + 1 } : null;
    }
    if (b.categories.some((c) => key(c.name) === key(s.category)) || s.level > len) return null;
    const name = placed[0]?.category ?? s.category;
    return key(name) === key(s.category) ? { ...s, category: name } : null;
  };
  return (line) => {
    const s = parseStreamLine(line);
    const c = s && !givesAway(s.clue, s.answer) && !used(s) ? fit(s) : null;
    if (!c || placed.some((p) => slotKey(p) === slotKey(c))) return null;
    placed.push(c);
    return c;
  };
}

/** Asks for the new category or level, handing over each clue as it lands. */
export function moreClues(b: QuizBoard, shape: MoreShape, run: MoreRun<StreamClue>): Promise<number> {
  const total = slotsFor(b, shape);
  return streamMore({
    system: SYSTEM,
    prompt: buildMorePrompt(b, shape, run.steer),
    count: total - run.avoid.length,
    maxTokens: Math.max(2000, 400 + total * 150),
    read: moreReader(b, shape, run.avoid),
    keyOf: slotKey,
    taken: run.avoid.map(slotKey),
    onItem: run.onItem,
    signal: run.signal,
  });
}

/** The board with the new category or level added and the kept clues in place; dropped ones stay empty tiles. */
export function addClues(b: QuizBoard, shape: MoreShape, kept: readonly StreamClue[]): QuizBoard {
  if (!kept.length) return b;
  let next = shape === 'category' ? edit.renameCategory(edit.addCategory(b), b.categories.length, kept[0].category) : edit.addLevel(b);
  if (next === b) return b;
  for (const k of kept) {
    const ci = shape === 'category' ? b.categories.length : b.categories.findIndex((c) => key(c.name) === key(k.category));
    next = edit.setClue(next, ci, k.level - 1, { clue: k.clue, answer: k.answer });
  }
  return next;
}
