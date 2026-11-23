// What makes a Doodle Brawl title usable: the content gate's rules (src/lib/content.test.ts),
// shared by the pack editor, "Make a pack" (pasted lists), the wizard and pack files
// (src/lib/listPack.ts).
import type { ListSpec } from '../../lib/listPack';

/** Characters in a title, at most (the longest built-in has 47). */
export const TITLE_MAX = 60;

/**
 * Two titles are the same when they match ignoring case, spacing and punctuation. The content
 * gate counts a title's words on this key too, so both count the same way.
 */
export const titleKey = (t: string): string => t.trim().toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');

/** How many words a title has, as the content gate counts them. */
export const titleWords = (t: string): number => titleKey(t).split(' ').length;

/** Closing full stop, ! or ? off; first letter capital. */
function tidyTitle(t: string): string {
  const s = t.trim().replace(/[.!?]+$/, '').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Why a title cannot be used, or '' when it can. */
export function titleProblem(t: string): string {
  const n = titleWords(t);
  if (n < 2) return 'too short';
  if (n > 8 || t.length > TITLE_MAX) return 'too long';
  if (!/^[A-Z]/.test(t)) return 'starts oddly';
  if (/[.!?]$/.test(t)) return 'ends in punctuation';
  return '';
}

export const BRAWL_LISTS: readonly ListSpec[] = [
  { field: 'titles', one: 'title', many: 'titles', tidy: tidyTitle, problem: titleProblem, key: titleKey, max: TITLE_MAX, example: "World's okayest roommate", hint: '2 to 8 words: a funny title someone can draw a fighter for.' },
];
