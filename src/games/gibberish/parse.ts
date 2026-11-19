// Turns Claude's "Phrase | Answer | Category" lines into cards, dropping anything that
// would make a bad card: headers, missing parts, or a phrase that gives the answer away.
import type { GibberishCard } from '../../lib/content';
import { dropNumberCells, pastedLines } from '../../lib/paste';

const FILLER = new Set(['a', 'an', 'the', 'of', 'and', 'in', 'on', 'to', 'for', 'at', 'by', 'or']);

/** Lower case without accents, so "Beyoncé" and "Beyonce" compare equal. */
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const words = (s: string) => fold(s).replace(/[^a-z0-9'\s-]/g, ' ').split(/[\s-]+/).map((w) => w.replace(/^'+|'+$/g, '')).filter(Boolean);

function tidy(part: string): string {
  return part
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s*(?:phrase|answer|category|hint)\s*[:=]\s*/i, '')
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when the phrase repeats a meaningful word of the answer (a giveaway). */
export function givesAway(phrase: string, answer: string): boolean {
  const said = new Set(words(phrase));
  return words(answer).some((w) => !FILLER.has(w) && w.length > 1 && said.has(w));
}

/** Why a line made no card: decoration to ignore, the wrong shape, or a giveaway phrase. */
export type LineFault = 'noise' | 'form' | 'giveaway';

/** One line → a card, or the reason it is not one. */
export function readLine(raw: string, fallbackCategory = ''): GibberishCard | LineFault {
  let line = raw.trim().replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '');
  line = line.replace(/^\|/, '').replace(/\|$/, '');
  let parts = line.split(/\s*[|\t]\s*/);
  if (parts.length < 2) parts = line.split(/\s+(?:→|->|=>|—)\s+/);
  if (parts.length < 2) return 'form';
  const [phrase, answer, category = ''] = parts.map(tidy);
  if (/^-+$/.test(phrase) || (/^phrase$/i.test(phrase) && /^answer$/i.test(answer))) return 'noise'; // table header or rule
  if (!phrase || !answer || !/[a-z]/i.test(phrase) || !/[a-z]/i.test(answer)) return 'form';
  if (phrase.length > 70 || answer.length > 60) return 'form';
  if (phrase.toLowerCase() === answer.toLowerCase() || givesAway(phrase, answer)) return 'giveaway';
  return { phrase, answer, hint: category || fallbackCategory };
}

export function parseLine(raw: string, fallbackCategory = ''): GibberishCard | null {
  const r = readLine(raw, fallbackCategory);
  return typeof r === 'string' ? null : r;
}

export const answerKey = (c: GibberishCard) => fold(c.answer).replace(/[^a-z0-9]/g, '');

// A pasted list (often copied from the Claude app): `Phrase | Answer | Category` per line,
// category optional. Every skipped line carries its reason.

const REASON: Record<Exclude<LineFault, 'noise'>, string> = {
  form: "not in 'Phrase | Answer' form",
  giveaway: 'phrase gives the answer away',
};



export interface PastedCards {
  items: GibberishCard[];
  /** One reason per skipped line. */
  skipped: string[];
}

export function parsePastedCards(text: string, existing: readonly GibberishCard[] = []): PastedCards {
  const have = new Set(existing.map(answerKey));
  const seen = new Set<string>();
  const out: PastedCards = { items: [], skipped: [] };
  for (const line of pastedLines(text)) {
    const r = readLine(dropNumberCells(line), 'Mixed');
    if (r === 'noise') continue;
    if (typeof r === 'string') { out.skipped.push(REASON[r]); continue; }
    const k = answerKey(r);
    if (have.has(k)) out.skipped.push('already in the pack');
    else if (seen.has(k)) out.skipped.push('repeated');
    else { seen.add(k); out.items.push(r); }
  }
  return out;
}
