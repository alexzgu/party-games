// What makes a Snark Tank prompt usable, shared by "Make a pack" (pasted lists) and pack files.
import { dedupe } from '../../lib/content';
import { firstCell, pastedLines } from '../../lib/paste';

export const MAX_PROMPT_CHARS = 140;

/** Why a prompt cannot be used, or '' when it can. */
export function promptProblem(q: string): '' | 'too short' | 'too long' {
  if (q.trim().split(/\s+/).length < 2) return 'too short';
  if (q.length > MAX_PROMPT_CHARS) return 'too long';
  return '';
}

/** A pasted list, one prompt per line (numbers, bullets and quotes dropped), plus why any line was skipped. */
export function parsePrompts(text: string): { items: string[]; skipped: string[] } {
  const skipped: string[] = [];
  const items: string[] = [];
  for (const line of pastedLines(text)) {
    const q = firstCell(line).replace(/^(\d+[.)]|[-*•])\s*/, '').replace(/^["“]|["”]$/g, '').trim();
    const why = promptProblem(q);
    if (why) skipped.push(why);
    else items.push(q);
  }
  const unique = dedupe(items);
  for (let i = unique.length; i < items.length; i++) skipped.push('repeated');
  return { items: unique, skipped };
}
