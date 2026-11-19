// Cleaning for generated lines: Claude is asked for bare Title Case items, one per line,
// but a stray bullet, number, quote or chatty preface must never reach a card.

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
