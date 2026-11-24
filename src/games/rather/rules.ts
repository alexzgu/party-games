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

/**
 * First words a question usually starts with: tidying lowercases them, as Brain Freeze lowercases
 * its own openers, so a name at the start ("Taylor Swift …") keeps its capital.
 */
const OPENERS = new Set(('be have live lose give never always only not eat drink fight date marry kiss hug spend get go know '
  + 'become travel work sleep wear own find win see hear read watch speak talk sing dance fly swim run walk drive move keep '
  + 'take make play forget remember stay wake quit skip share use buy sell switch trade text call sit smell sound look feel '
  + 'cook clean wash shower let tell ask answer pay owe borrow lend sneeze burp cry laugh scream whisper shout star appear '
  + 'meet host attend join leave start finish delete post send receive accidentally secretly publicly permanently instantly').split(' '));

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

/** No leading "Would you rather" (with a comma or colon after it), no closing punctuation, "or" in lowercase, a usual first word lowercased. */
export function tidyRather(p: string): string {
  const s = stripEnd(p.trim().replace(LEAD, ''), CLOSERS).trim().replace(OR, 'or');
  const first = s.split(' ')[0];
  return OPENERS.has(first.toLowerCase()) ? first.toLowerCase() + s.slice(first.length) : s;
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
