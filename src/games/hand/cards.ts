// Bad Hand cards: a prompt's blanks and how a played hand reads in it.

/** A blank in a prompt card. */
export const BLANK = '___';

/** How many blanks a prompt has (0 means it is a question answered by one card). */
export const blanks = (prompt: string): number => prompt.split(BLANK).length - 1;

/** How many answer cards a prompt takes. */
export const picks = (prompt: string): number => Math.max(1, blanks(prompt));

/** Characters a player may type on a blank answer card. */
export const BLANK_MAX = 60;

/** One run of a filled-in prompt: the prompt's own words, or a played answer (`filled`). */
export type Part = { text: string; filled: boolean };

/**
 * A prompt with the played answers in its blanks, in order; a question shows the answer after
 * it. An empty slot stays a blank. Where the answer ends in its own ! or ?, the prompt's
 * full stop right after the blank is dropped ("Wow!" not "Wow!.").
 */
export function fill(prompt: string, answers: readonly string[]): Part[] {
  const pieces = prompt.split(BLANK);
  if (pieces.length === 1) return [{ text: prompt, filled: false }, ...answers.slice(0, 1).map((text) => ({ text, filled: true }))];
  const parts: Part[] = [];
  pieces.forEach((piece, i) => {
    const before = answers[i - 1];
    const text = i > 0 && before && /[.!?]$/.test(before) ? piece.replace(/^\./, '') : piece;
    if (text) parts.push({ text, filled: false });
    if (i < pieces.length - 1) parts.push(answers[i] ? { text: midSentence(text) ? inline(answers[i]) : answers[i], filled: true } : { text: BLANK, filled: false });
  });
  return parts;
}

/** Text before a blank that leaves the blank inside a sentence, not at its start. */
const midSentence = (before: string): boolean => before.trim() !== '' && !/[.!?:]\s*$/.test(before);

/** Opening words an answer card can lose its capital on mid-sentence; never a name. */
const COMMON = /^(A|An|The|My|Your|Our|His|Her|Their|Some|Someone's|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Sixteen|Forty(-\w+)?|Ninety|Zero|[A-Z][a-z]+(-[a-z]+)*ing)$/;

/** An answer card as it reads inside a sentence: "says a haunted air fryer", names untouched. */
export function inline(answer: string): string {
  const first = answer.split(' ')[0];
  return COMMON.test(first) ? answer[0].toLowerCase() + answer.slice(1) : answer;
}

/** The filled-in prompt as one line (History, the end screen). */
export const filled = (prompt: string, answers: readonly string[]): string =>
  fill(prompt, answers).map((p) => p.text).join(blanks(prompt) ? '' : ' ');
