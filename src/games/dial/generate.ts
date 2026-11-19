// "Make with Claude" for Spectrum: asks for one `Left | Right` card per line and turns each
// streamed line into a card, tolerating the list markers, quotes and odd separators models add.
import { streamLines } from '../../lib/claude';
import type { Spectrum } from '../../lib/content';
import { cardId } from './state';
import { dropNumberCells, pastedLines } from '../../lib/paste';

export const BATCH = 20;
const MAX_END = 40;
const MAX_AVOID = 150;

export const THEME_CHIPS = [
  'Mixed bag', 'Movies & TV', 'Food & drink', 'Music', 'Internet culture', 'Sports',
  'Travel', 'Work life', 'Dating', 'Big questions', 'Childhood', 'Spicy (adults)',
];

export const SYSTEM = `You write cards for Spectrum, a party game in the style of Wavelength.
Each card is a scale between two opposite ends. One player secretly gets a spot on the scale and says a clue (a thing, person, place or idea) that belongs at that spot; their team guesses where it sits.
Good cards: two clear opposites with a smooth range between them, so hundreds of answers fit somewhere along it; short ends of one to three words; fun to argue about; a mix of factual scales (Cold | Hot) and opinion scales (Underrated | Overrated).
Avoid: scales with only two possible answers, ends that are not true opposites, and anything mean about real groups of people.
Output only the cards, one per line, formatted exactly as: Left end | Right end
No numbering, headings, blank lines or commentary.`;

export function buildPrompt(theme: string, avoid: Spectrum[], count = BATCH): string {
  const t = theme.trim() || 'Mixed bag';
  let p = `Theme: ${t}\nWrite ${count} cards for this theme.`;
  const recent = avoid.slice(-MAX_AVOID);
  if (recent.length) {
    p += `\nThese cards already exist. Do not repeat them or closely rephrase them:\n`;
    p += recent.map((c) => `${c.left} | ${c.right}`).join('\n');
  }
  return p;
}

// Tried in order; the first that splits the line into exactly two ends wins.
const SEPARATORS: RegExp[] = [
  /\s*\|\s*/,
  /\s+(?:<->|<=>|↔|⟷|⇔|vs\.?|versus)\s+/i,
  /\s*(?:<->|↔|⟷|⇔|→|->)\s*/,
  /\s+[—–]\s+/,
  /\s+--?\s+/,
  /\s+\/\s+/,
];

// Double quotes always come off; single quotes only as a matching pair, so the apostrophe
// in "'90s kid" or "Kids'" stays.
function unquote(s: string): string {
  const t = s.replace(/^["“”]+|["“”]+$/g, '').trim();
  return /^['‘].*['’]$/.test(t) && t.length > 1 ? t.slice(1, -1).trim() : t;
}

function tidyEnd(s: string): string {
  const t = unquote(s.replace(/[.,;:!]+$/, '').trim()).replace(/[.,;:!]+$/, '').replace(/\s+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** List markers and "Card 1:" style prefixes models sometimes add. */
const PREFIX = /^\s*(?:[-*•]\s+|\d+[.)]\s+|card\s*\d+\s*[:.)-]\s*)/i;

const hasWord = (s: string) => /[\p{L}\p{N}]/u.test(s);

/** One streamed line to a card, or null when the line is not a usable `Left | Right` pair. */
export function parsePair(raw: string): Spectrum | null {
  const line = raw.replace(/\*\*|__|`/g, '')
    .replace(PREFIX, '')
    .replace(/^\s*\|\s*|\s*\|\s*$/g, '') // markdown table row
    .trim();
  if (!line || line.startsWith('#') || /:$/.test(line)) return null;
  for (const sep of SEPARATORS) {
    const parts = line.split(sep);
    if (parts.length < 2) continue;
    if (parts.length > 2) return null;
    const [left, right] = parts.map(tidyEnd);
    if (!hasWord(left) || !hasWord(right)) return null;
    if (left.length > MAX_END || right.length > MAX_END) return null;
    if (left.toLowerCase() === right.toLowerCase()) return null;
    if (/^left( end)?$/i.test(left) && /^right( end)?$/i.test(right)) return null;
    return { left, right };
  }
  return null;
}

export interface GenerateOptions {
  theme: string;
  avoid: Spectrum[];
  onPair: (card: Spectrum) => void;
  signal?: AbortSignal;
}

export function generatePairs(opts: GenerateOptions): Promise<void> {
  return streamLines({
    system: SYSTEM,
    prompt: buildPrompt(opts.theme, opts.avoid),
    signal: opts.signal,
    maxTokens: 2000,
    onLine: (line) => {
      const card = parsePair(line);
      if (card) opts.onPair(card);
    },
  });
}

// A pasted list (often copied from the Claude app): one `Left | Right` card per line, read
// with the same parser as streamed lines. Every skipped line carries its reason.




export interface PastedPairs {
  items: Spectrum[];
  /** One reason per skipped line. */
  skipped: string[];
}

export function parsePastedPairs(text: string, existing: readonly Spectrum[] = []): PastedPairs {
  const have = new Set(existing.map(cardId));
  const seen = new Set<string>();
  const out: PastedPairs = { items: [], skipped: [] };
  for (const line of pastedLines(text)) {
    const card = parsePair(dropNumberCells(line));
    const k = card ? cardId(card) : '';
    if (!card) out.skipped.push("not in 'Left | Right' form");
    else if (have.has(k)) out.skipped.push('already in the pack');
    else if (seen.has(k)) out.skipped.push('repeated');
    else { seen.add(k); out.items.push(card); }
  }
  return out;
}
