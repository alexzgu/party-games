// What makes a Sketchy word or idea usable: the content gate's rules (src/lib/content.test.ts),
// shared by the pack editor, "Make a pack" (pasted lists), the wizard and pack files
// (src/lib/listPack.ts).
import { stripEnd, type ListSpec } from '../../lib/listSpec';

export const WORD_MAX = 24;
export const IDEA_MAX = 70;

const words = (s: string): number => s.trim().split(/\s+/).filter(Boolean).length;

/** Two words (or ideas) are the same when they match ignoring case, spacing and punctuation. */
export const sameKey = (s: string): string => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

/** Closing punctuation off, first letter capital. */
function tidy(s: string): string {
  const t = stripEnd(s.trim(), '.!?,;:').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Why a word cannot be drawn and guessed, or '' when it can. */
export function wordProblem(w: string): string {
  if (!/^[A-Za-z][A-Za-z' -]*[A-Za-z]$/.test(w)) return 'letters, spaces, hyphens and apostrophes only';
  if (words(w) > 3 || w.length > WORD_MAX) return 'too long';
  return '';
}

/** Why an idea cannot start a chain, or '' when it can. */
export function ideaProblem(i: string): string {
  if (words(i) < 3) return 'too short';
  if (words(i) > 10 || i.length > IDEA_MAX) return 'too long';
  if (!/^[A-Z0-9]/.test(i)) return 'starts oddly';
  if (/[.!?,;:]$/.test(i)) return 'ends in punctuation';
  return '';
}

export const SKETCH_LISTS: readonly ListSpec[] = [
  { field: 'words', one: 'word', many: 'words', tidy, problem: wordProblem, key: sameKey, max: WORD_MAX, example: 'Bunk bed', hint: 'For Draw & guess: 1 to 3 words, letters only, something you can draw.' },
  { field: 'ideas', one: 'idea', many: 'ideas', tidy, problem: ideaProblem, key: sameKey, max: IDEA_MAX, example: 'A raccoon cramming for finals', hint: 'For Telephone: 3 to 10 words, a scene someone can draw.' },
];
