// Reading prompts people type or paste ("Name 3 pizza toppings", "- things in a fridge."):
// the "Name 3" lead-in, list markers, quotes and end punctuation are dropped, so every
// prompt is stored the same way the built-in packs store theirs.
import { cleanItem } from '../../lib/claude';
import { firstCell, pastedLines } from '../../lib/paste';
import { promptKey } from './logic';

export const MAX_WORDS = 10;

/** One typed or pasted line → the bare prompt ("pizza toppings"), or '' when nothing is left. */
export function cleanPrompt(raw: string): string {
  let p = cleanItem(firstCell(raw.trim()))
    .replace(/\*\*|__|`/g, '')
    .replace(/^name\s+(?:3|three)\b\s*:?\s*/i, '')
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, '')
    .replace(/[\s.,;:!?…]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  // "Name 3 Things in a fridge" → "things in a fridge"; a name ("Taylor Swift songs") keeps its capital.
  if (/^(?:things|words|ways|reasons|places|kinds|types|foods|animals|songs|movies|shows|people|famous|excuses|jobs|names)\b/i.test(p)) {
    p = p[0].toLowerCase() + p.slice(1);
  }
  return p;
}

/** A prompt as the line `cleanPrompt` reads. */
export const promptLine = (p: string): string => p;

/** Why a cleaned prompt cannot be used, or '' when it can. */
export function promptError(p: string, others: readonly string[]): string {
  if (!p) return 'Type what to name 3 of.';
  const n = p.split(' ').length;
  if (n > MAX_WORDS) return `Keep it to ${MAX_WORDS} words or fewer (this has ${n}).`;
  if (p.length > 80) return 'That is too long to read in a second.';
  if (others.some((o) => promptKey(o) === promptKey(p))) return 'That one is already in this pack.';
  return '';
}

/** A pasted list → the prompts in it, plus why any line was skipped. */
export function parsePasted(text: string, existing: readonly string[] = []): { items: string[]; skipped: string[] } {
  const items: string[] = [];
  const skipped: string[] = [];
  for (const line of pastedLines(text)) {
    // A heading over a list ("# Food", "Summer prompts:") is not a prompt.
    if (/^\s*#/.test(line) || /:\s*$/.test(line)) {
      skipped.push('a heading');
      continue;
    }
    const p = cleanPrompt(line);
    if (!p) continue;
    const why = promptError(p, [...existing, ...items]);
    if (why) skipped.push(why.startsWith('That one') ? 'already in the pack' : 'too long');
    else items.push(p);
  }
  return { items, skipped };
}
