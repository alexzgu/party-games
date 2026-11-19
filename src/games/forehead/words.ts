// Cleaning for generated lines: Claude is asked for bare Title Case items, one per line,
// but a stray bullet, number, quote or chatty preface must never reach a card.
import { firstCell, pastedLines } from '../../lib/paste';

export const MAX_WORDS_PER_ITEM = 4;
export const MAX_ITEM_CHARS = 40;

const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs']);

export function titleCase(s: string): string {
  return s
    .split(' ')
    .map((w, i) => (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** One generated line → a playable item, or null when the line is not an item at all. */
export function cleanLine(line: string): string | null {
  let s = line
    .replace(/^\s*(?:[-*•–]|\d+[.)]|#+)\s*/, '')
    .replace(/[*_`]+/g, '')
    .replace(/^["“”'‘’]+|["“”'‘’]+$/g, '')
    .replace(/[.,;!]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s || s.endsWith(':') || /:\s/.test(s)) return null;
  if (/^(here|sure|okay|ok|note|these|i )/i.test(s) && s.split(' ').length > 3) return null;
  if (s.length > MAX_ITEM_CHARS || s.split(' ').length > MAX_WORDS_PER_ITEM) return null;
  if (s === s.toLowerCase() || s === s.toUpperCase()) s = titleCase(s.toLowerCase());
  return s;
}

export const itemKey = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

// A pasted list (often copied from the Claude app): one item per line, commas also split.
// Every skipped line carries its reason so the screen can say why.




const tooLong = (s: string) => s.length > MAX_ITEM_CHARS || s.split(/\s+/).length > MAX_WORDS_PER_ITEM;

export interface PastedWords {
  items: string[];
  /** One reason per skipped line or comma-separated piece. */
  skipped: string[];
}

export function parsePastedWords(text: string, existing: readonly string[] = []): PastedWords {
  const have = new Set(existing.map(itemKey));
  const seen = new Set<string>();
  const out: PastedWords = { items: [], skipped: [] };
  for (const line of pastedLines(text)) {
    const body = firstCell(line).replace(/^\s*(?:[-*•–]|\d+[.)])\s*/, '');
    const pieces = body.split(',').map((p) => p.trim()).filter(Boolean);
    // A comma inside a sentence is prose, not a list: skip the whole line.
    if (pieces.length > 1 && pieces.some(tooLong)) { out.skipped.push('not a word or phrase'); continue; }
    for (const piece of pieces.length ? pieces : [body]) {
      const item = cleanLine(piece);
      const k = item ? itemKey(item) : '';
      if (!item || !k) out.skipped.push(tooLong(piece) && !/:(\s|$)/.test(piece) ? 'too long for a card' : 'not a word or phrase');
      else if (have.has(k)) out.skipped.push('already in the deck');
      else if (seen.has(k)) out.skipped.push('repeated');
      else { seen.add(k); out.items.push(item); }
    }
  }
  return out;
}
