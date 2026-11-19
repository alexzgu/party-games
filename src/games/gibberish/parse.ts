// Turns Claude's "Phrase | Answer | Category" lines into cards, dropping anything that
// would make a bad card: headers, missing parts, or a phrase that gives the answer away.
import type { GibberishCard } from '../../lib/content';

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

export function parseLine(raw: string, fallbackCategory = ''): GibberishCard | null {
  let line = raw.trim().replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '');
  line = line.replace(/^\|/, '').replace(/\|$/, '');
  let parts = line.split(/\s*[|\t]\s*/);
  if (parts.length < 2) parts = line.split(/\s+(?:→|->|=>|—)\s+/);
  if (parts.length < 2) return null;
  const [phrase, answer, category = ''] = parts.map(tidy);
  if (!phrase || !answer || !/[a-z]/i.test(phrase) || !/[a-z]/i.test(answer)) return null;
  if (/^-+$/.test(phrase) || (/^phrase$/i.test(phrase) && /^answer$/i.test(answer))) return null; // table header or rule
  if (phrase.length > 70 || answer.length > 60) return null;
  if (phrase.toLowerCase() === answer.toLowerCase() || givesAway(phrase, answer)) return null;
  return { phrase, answer, hint: category || fallbackCategory };
}

export const answerKey = (c: GibberishCard) => fold(c.answer).replace(/[^a-z0-9]/g, '');
