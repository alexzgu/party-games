// "🧙 Ask the wizard" for Spectrum: asks for one `Left | Right` card per line and turns each
// streamed line into a card, tolerating the list markers, quotes and odd separators models add.
import { streamLines } from '../../lib/claude';
import type { Spectrum, SpectrumPack } from '../../lib/content';
import { morePrompt, streamMore, type MoreRun } from '../../lib/addMore';
import { cardId } from './state';
import { dropNumberCells, pastedLines } from '../../lib/paste';
import { askedFor, withNameAsk } from '../../lib/wizardAsk';

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

/** The prompt for `count` cards from the player's `request`, never one in `avoid`; `named`: ask for a pack name too. */
export function buildPrompt(request: string, avoid: Spectrum[], count = BATCH, named = false): string {
  let p = withNameAsk([askedFor(request, 'Mixed bag'), `Write ${count} cards for this request.`], named).join('\n');
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
  /** When given, Fizzwick also suggests the pack's name, handed here. */
  onName?: (name: string) => void;
  signal?: AbortSignal;
}

export function generatePairs(opts: GenerateOptions): Promise<void> {
  return streamLines({
    system: SYSTEM,
    prompt: buildPrompt(opts.theme, opts.avoid, BATCH, !!opts.onName),
    signal: opts.signal,
    onName: opts.onName,
    maxTokens: 2000,
    onLine: (line) => {
      const card = parsePair(line);
      if (card) opts.onPair(card);
    },
  });
}

/** "🧙 Add more" on a pack: how many cards to ask for. */
export const MORE_RANGE = { start: 10, min: 5, max: 40, step: 5 };

const asLine = (c: Spectrum) => `${c.left} | ${c.right}`;

/**
 * More cards on top of `pack`, never one of its cards, of those already written this time or of
 * `others` (every other pack's cards: a scale is never in two packs).
 */
export function moreCards(pack: SpectrumPack, others: readonly Spectrum[], run: MoreRun<Spectrum>): Promise<number> {
  const have = [...run.avoid, ...pack.cards];
  return streamMore({
    system: SYSTEM,
    prompt: morePrompt({ name: pack.name, blurb: pack.blurb, have: have.map(asLine), others: others.map(asLine) }, run, 'cards'),
    count: run.count, maxTokens: 3000, read: parsePair, keyOf: cardId, taken: [...have, ...others].map(cardId), onItem: run.onItem, signal: run.signal,
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
