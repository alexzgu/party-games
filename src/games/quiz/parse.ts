// Reading boards from text: a pasted board ("# Category" then "clue | answer" lines) and the
// lines Claude streams ("Category | level | clue | answer"). Both are forgiving about the
// extras people and models add: list markers, tables, bold, "Q:"/"A:", value columns.
import type { QuizBoard, QuizCategory } from '../../lib/content';
import { dropNumberCells, pastedLines } from '../../lib/paste';
import { MAX_CATEGORIES, MAX_LEVELS } from './board';

const MARKER = /^\s*(?:[-*•–—]|\d+[.)])\s+/;
const HEADING = /^(?:#{1,6}\s*(.+?)\s*#*|\*\*(.+?)\*\*:?|__(.+?)__:?|\[(.+?)\]|category\s*\d*\s*[:–-]\s*(.+)|([^|\t]{1,48}):)$/i;
/** A cell that only says which row: "3", "300", "L3", "Level 3", "$400". */
const LEVEL_CELL = /^(?:level|lvl|l|row|\$)?\s*(\d{1,4})$/i;

const tidy = (s: string) => s.replace(/\*\*|__/g, '').replace(/\s+/g, ' ').trim();
const strip = (s: string, label: RegExp) => tidy(s.replace(label, ''));
const key = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** A heading line's category name, or null when the line is not a heading. */
export function headingName(line: string): string | null {
  const m = HEADING.exec(line.trim());
  if (!m) return null;
  const name = tidy(m.slice(1).find(Boolean) ?? '');
  return name && !/^(?:clue|answer|q|a)$/i.test(name) ? name.slice(0, 40) : null;
}

/** The text cells of a line: list markers, table pipes and row-number or value cells dropped. */
function cells(line: string): string[] {
  const raw = dropNumberCells(line.replace(MARKER, ''));
  const parts = raw.split(/\s*(?:\||\t|\s→\s)\s*/).map(tidy).filter(Boolean);
  // A level or value column ("300") goes; a number that is the answer stays.
  return parts.length > 2 ? parts.filter((p, i) => i === parts.length - 1 || !LEVEL_CELL.test(p)) : parts;
}

const answerOf = (s: string) => strip(s, /^(?:answer|a)\s*[:.]\s*/i).replace(/^["“]|["”]$/g, '');
const clueOf = (s: string) => strip(s, /^(?:clue|question|q)\s*[:.]\s*/i);

/**
 * "clue | answer" → the pair, with any "Clue:"/"Q:" and "Answer:"/"A:" labels taken off.
 * Three cells read as "category | clue | answer" (a pasted table with a category column).
 */
export function clueLine(line: string): { category?: string; clue: string; answer: string } | null {
  const c = cells(line);
  if (c.length < 2) return null;
  const answer = answerOf(c[c.length - 1]);
  const clue = clueOf(c.length >= 3 ? c.slice(1, -1).join(' | ') : c[0]);
  if (!clue || !answer) return null;
  return c.length >= 3 ? { category: c[0].slice(0, 40), clue, answer } : { clue, answer };
}

export interface PastedBoard { board: QuizBoard | null; skipped: string[] }

/**
 * A pasted board. Each heading starts a category; the clue lines under it run easiest first.
 * Clue lines before any heading go in "Category 1". Shorter categories are padded with empty
 * tiles to the longest (the editor shows them); past 8 categories or 10 levels is cut off.
 */
export function parsePastedBoard(text: string, name = ''): PastedBoard {
  const skipped: string[] = [];
  const cats: QuizCategory[] = [];
  const seen = new Set<string>();
  const rank = new Map<object, number>();
  const current = () => cats.at(-1) ?? (cats.push({ name: 'Category 1', clues: [] }), cats[0]);
  for (const line of pastedLines(text)) {
    const stream = parseStreamLine(line);
    const heading = stream || line.includes('|') ? null : headingName(line);
    if (heading) {
      if (cats.some((c) => key(c.name) === key(heading))) skipped.push('repeated category');
      else cats.push({ name: heading, clues: [] });
      continue;
    }
    const pair = stream ?? clueLine(line);
    if (!pair) { skipped.push("not in 'clue | answer' form"); continue; }
    if (seen.has(key(pair.clue))) { skipped.push('repeated clue'); continue; }
    seen.add(key(pair.clue));
    const named = pair.category;
    const cat = named ? (cats.find((c) => key(c.name) === key(named)) ?? (cats.push({ name: named, clues: [] }), cats.at(-1)!)) : current();
    const clue = { clue: pair.clue, answer: pair.answer };
    if (stream) rank.set(clue, stream.level);
    cat.clues.push(clue);
  }
  // Streamed lines say their level, so they may arrive row by row: put each column in order.
  for (const c of cats) c.clues = c.clues.map((k, i) => ({ k, at: rank.get(k) ?? i + 1 })).sort((a, b) => a.at - b.at).map((x) => x.k);
  const used = cats.filter((c) => c.clues.length);
  for (const c of used.slice(MAX_CATEGORIES)) for (const _ of c.clues) skipped.push(`past ${MAX_CATEGORIES} categories`);
  const kept = used.slice(0, MAX_CATEGORIES);
  for (const c of kept) for (const _ of c.clues.slice(MAX_LEVELS)) skipped.push(`past ${MAX_LEVELS} clues in a category`);
  if (!kept.length) return { board: null, skipped };
  const len = Math.min(MAX_LEVELS, Math.max(...kept.map((c) => c.clues.length)));
  const categories = kept.map((c) => ({
    name: c.name,
    clues: Array.from({ length: len }, (_, r) => c.clues[r] ?? { clue: '', answer: '' }),
  }));
  return { board: { id: '', name: name.trim() || 'Pasted pack', blurb: 'Pasted on this phone', categories }, skipped };
}

export interface StreamClue { category: string; /** 1 = easiest (top row). */ level: number; clue: string; answer: string }

/** A tile's text as it can sit in one stream line: one line, no "|" (it separates the cells). */
export const streamCell = (s: string): string => tidy(s.replace(/\|/g, '/'));

/** One clue as Fizzwick writes it, each cell made safe (`parseStreamLine(streamLine(s))` gives back `s` made safe). */
export const streamLine = (s: StreamClue): string => [s.category, String(s.level), s.clue, s.answer].map(streamCell).join(' | ');

/** The four cells of a stream line only tidied (no labels or quotes taken off), to match a tile as sent; null when not four. */
export function streamCells(line: string): StreamClue | null {
  const parts = line.replace(MARKER, '').replace(/^\||\|$/g, '').split('|').map(tidy);
  const m = parts.length === 4 ? LEVEL_CELL.exec(parts[1]) : null;
  if (!m) return null;
  const n = Number(m[1]);
  return { category: parts[0], level: n >= 100 && n % 100 === 0 ? n / 100 : n, clue: parts[2], answer: parts[3] };
}

/**
 * One streamed line, "Category | level | clue | answer", or null for anything else (a header
 * row, a remark). The level may be written 3, "Level 3" or as its value, 300.
 */
export function parseStreamLine(line: string): StreamClue | null {
  const parts = line.replace(MARKER, '').replace(/^\||\|$/g, '').split('|').map(tidy);
  if (parts.length < 4) return null;
  const m = LEVEL_CELL.exec(parts[1]);
  if (!m) return null;
  const n = Number(m[1]);
  const level = n >= 100 && n % 100 === 0 ? n / 100 : n;
  const category = parts[0].replace(/^#+\s*/, '').slice(0, 40);
  const clue = clueOf(parts.slice(2, -1).join(' | '));
  const answer = answerOf(parts[parts.length - 1]);
  if (!category || !clue || !answer || level < 1) return null;
  return { category, level, clue, answer };
}
