// What makes a Would You Rather question usable: the content gate's rules (src/lib/content.test.ts),
// shared by the pack editor, "Make a pack" (pasted lists), the wizard and pack files
// (src/lib/listPack.ts). The app shows "Would you rather" in front of each question, so a pack
// stores only the rest: two choices joined by one " or " ("be able to fly or be invisible").
import { stripEnd, type ListSpec } from '../../lib/listSpec';

/** Characters in one choice, at most. */
export const CHOICE_MAX = 60;
/** Words in one choice, at most. */
export const CHOICE_WORDS_MAX = 12;
/** Characters in the whole question, at most. */
export const PROMPT_MAX = 130;

/** The word "or" with a space on each side, any case: what splits the two choices. */
const OR = /(?<= )or(?= )/gi;
const LEAD = /^would\s+you\s+rather\b[\s,:]*/i;
/** Closing punctuation tidying drops (as Brain Freeze's does). */
const CLOSERS = '.,;:!?…';

/** The two choices, trimmed: the text before and after the first " or " (a usable question has one). */
export function sides(prompt: string): [string, string] {
  const i = prompt.search(/ or /i);
  return i < 0 ? [prompt.trim(), ''] : [prompt.slice(0, i).trim(), prompt.slice(i + 4).trim()];
}

/** A choice ignoring case, spacing and punctuation. */
const choiceKey = (c: string): string => c.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const choiceWords = (c: string): number => choiceKey(c).split(' ').filter(Boolean).length;

/**
 * Two questions are the same when their choices match ignoring case, spacing, punctuation and
 * order: "fly or be invisible" and "be invisible or fly" are one question.
 */
export const ratherKey = (p: string): string => sides(p).map(choiceKey).sort().join(' | ');

/** A first word that is one capital then only lowercase letters or apostrophes ("Lick", "Don't"), not "DJ" or "iPhone". */
const CAPITALISED = /^[A-Z][a-z'’]*(?= |$)/;

/**
 * No leading "Would you rather" (with a comma or colon after it), no closing punctuation, "or" in
 * lowercase, and a capitalised first word lowercased: what follows "Would you rather" is a verb or
 * an adverb, never a name. A first word like "DJ" is left as it is (and then starts oddly).
 */
export function tidyRather(p: string): string {
  const s = stripEnd(p.trim().replace(LEAD, ''), CLOSERS).trim().replace(OR, 'or');
  return CAPITALISED.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}

/** Why a tidied question cannot be used, or '' when it can. */
export function ratherProblem(p: string): string {
  if (!p.trim()) return 'too short';
  if ((p.match(OR) ?? []).length !== 1) return 'needs one "or"';
  const [a, b] = sides(p);
  if (!choiceWords(a) || !choiceWords(b)) return 'too short';
  if (p.length > PROMPT_MAX || [a, b].some((c) => c.length > CHOICE_MAX || choiceWords(c) > CHOICE_WORDS_MAX)) return 'too long';
  if (choiceKey(a) === choiceKey(b)) return 'both choices are the same';
  if (!/^[a-z]/.test(p) || LEAD.test(p)) return 'starts oddly';
  if (/[.,;:!?…]$/.test(p)) return 'ends in punctuation';
  return '';
}

export const RATHER_LISTS: readonly ListSpec[] = [
  {
    field: 'prompts', one: 'question', many: 'questions', tidy: tidyRather, problem: ratherProblem, key: ratherKey, max: PROMPT_MAX,
    example: 'be able to fly or be invisible', hint: 'Two choices joined by "or", up to 12 words each; "Would you rather" is shown in front.',
  },
];
