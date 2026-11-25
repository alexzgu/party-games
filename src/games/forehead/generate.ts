// "🧙 Ask the wizard" for Heads Down: the player's request in, recognisable party words streamed out.
import { streamLines } from '../../lib/claude';
import { morePrompt, streamMore, type MoreRun } from '../../lib/addMore';
import type { WordDeck } from '../../lib/content';
import { cleanLine, itemKey } from './words';
import { askedFor, withNameAsk } from '../../lib/wizardAsk';

export const THEME_CHIPS = [
  '90s kids', 'Disney', 'Reality TV', 'Famous duos', 'Things at a wedding', 'Superheroes',
  'Breakfast foods', 'Board games', 'Pop divas', 'Road trip', 'Fast food', 'Halloween',
  'Office life', 'Dog breeds', 'Dance moves', 'Cartoons',
];

export const SYSTEM = `You write cards for Heads Down, a Heads Up-style party game. One player holds the phone to their forehead without seeing the card; friends shout clues until they guess it.

Write items that a group of adults in their 20s at a house party would instantly recognise and could clue within a few seconds: well-known names, titles, things, places and phrases. Mix easy and medium; skip anything obscure, niche or that needs explaining.

Format, strictly:
- One item per line, nothing else: no numbering, bullets, quotes, emoji, headings, notes or blank lines.
- Title Case, at most 4 words, no subtitles or colons.
- No duplicates or near-duplicates, and no item that gives away another.`;

/** The prompt for `count` items from the player's `request`, never one in `avoid`; `named`: ask for a pack name too. */
export function buildPrompt(request: string, count: number, avoid: readonly string[], named = false): string {
  const parts = withNameAsk([askedFor(request, 'anything fun'), `Write ${count} items.`], named);
  if (avoid.length) {
    parts.push(
      'More in the same spirit as the items below, but none of them again (not even reworded):',
      avoid.slice(-200).join('\n'),
    );
  }
  return parts.join('\n\n');
}

export interface GenerateOptions {
  theme: string;
  count: number;
  /** Words already in the target deck or already generated; never repeated. */
  avoid: readonly string[];
  onItem: (item: string) => void;
  /** When given, Fizzwick also suggests the pack's name, handed here. */
  onName?: (name: string) => void;
  signal: AbortSignal;
}

export async function generateWords(o: GenerateOptions): Promise<void> {
  const seen = new Set(o.avoid.map(itemKey));
  let n = 0;
  await streamLines({
    system: SYSTEM,
    prompt: buildPrompt(o.theme, o.count, o.avoid, !!o.onName),
    signal: o.signal,
    onName: o.onName,
    maxTokens: 4000,
    onLine: (line) => {
      const item = cleanLine(line);
      if (!item || n >= o.count) return;
      const k = itemKey(item);
      if (!k || seen.has(k)) return;
      seen.add(k);
      n++;
      o.onItem(item);
    },
  });
}

/** "🧙 Add more" on a pack: how many words to ask for. */
export const MORE_RANGE = { start: 20, min: 10, max: 80, step: 10 };

/** More words on top of `deck`, never one of its words or of those already written this time. */
export function moreWords(deck: WordDeck, run: MoreRun<string>): Promise<number> {
  const have = [...run.avoid, ...deck.words];
  return streamMore({
    system: SYSTEM,
    prompt: morePrompt({ name: deck.name, blurb: deck.blurb, have }, run, 'items'),
    count: run.count, maxTokens: 4000, read: cleanLine, keyOf: itemKey, taken: have.map(itemKey), onItem: run.onItem, signal: run.signal,
  });
}
