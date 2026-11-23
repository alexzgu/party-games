// What makes a Bad Hand card usable: the content gate's rules (src/lib/content.test.ts), shared by
// the pack editor, "Make a pack" (pasted lists), the wizard and pack files (src/lib/listPack.ts).
import { BLANK, blanks } from './cards';
import type { ListSpec } from '../../lib/listPack';

export const PROMPT_MAX = 140;
export const ANSWER_MAX = 60;

const words = (s: string): number => s.trim().split(/\s+/).length;

/** Two cards are the same when they match ignoring case, spacing and punctuation. */
export const sameKey = (s: string): string => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
export const promptKey = (p: string): string => sameKey(p.replaceAll(BLANK, ' blank '));

const capital = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

/** Any run of two or more underscores is one blank; first letter capital. */
export const tidyPrompt = (p: string): string => capital(p.trim().replace(/_{2,}/g, BLANK));

/** Closing full stop (or comma, colon, semicolon) off; first letter capital. */
export const tidyAnswer = (a: string): string => capital(a.trim().replace(/[.,;:]+$/, '').trim());

/** Why a prompt cannot be used, or '' when it can. */
export function promptProblem(p: string): string {
  const n = blanks(p);
  if (n > 2) return 'more than two blanks';
  if (p.replaceAll(BLANK, '').includes('_')) return 'a blank is three underscores';
  if (n === 0 && !p.endsWith('?')) return 'no blank (___) and not a question';
  if (!/^[A-Z0-9_"]/.test(p) || words(p.replaceAll(BLANK, 'x')) < 3) return 'too short';
  if (p.length > PROMPT_MAX) return 'too long';
  return '';
}

/** Why an answer cannot be used, or '' when it can. */
export function answerProblem(a: string): string {
  if (!/^[A-Z0-9"]/.test(a)) return 'starts oddly';
  if (a.includes('_')) return 'has a blank';
  if (/[.,;:]$/.test(a)) return 'ends in a full stop';
  if (words(a) > 10 || a.length > ANSWER_MAX) return 'too long';
  return '';
}

export const HAND_LISTS: readonly ListSpec[] = [
  { field: 'prompts', one: 'prompt', many: 'prompts', tidy: tidyPrompt, problem: promptProblem, key: promptKey, max: PROMPT_MAX, example: 'My therapist says my biggest problem is ___', hint: 'Type ___ for each blank, two at most. No blank? Make it a question ending in ?' },
  { field: 'answers', one: 'answer', many: 'answers', tidy: tidyAnswer, problem: answerProblem, key: sameKey, max: ANSWER_MAX, example: 'A suspiciously large rice cooker', hint: 'Up to 10 words; a thing or a person fits most prompts.' },
];

/** A pasted card is a prompt when it has a blank or asks a question; anything else is an answer. */
export const cardList = (line: string): 'prompts' | 'answers' => (/_{2,}/.test(line) || line.trim().endsWith('?') ? 'prompts' : 'answers');
