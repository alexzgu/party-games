// "Make with Claude" for Hot Head: a theme in, recognisable party words streamed out.
import { streamLines } from '../../lib/claude';
import { cleanLine, itemKey } from './words';

export const THEME_CHIPS = [
  '90s kids', 'Disney', 'Reality TV', 'Famous duos', 'Things at a wedding', 'Superheroes',
  'Breakfast foods', 'Board games', 'Pop divas', 'Road trip', 'Fast food', 'Halloween',
  'Office life', 'Dog breeds', 'Dance moves', 'Cartoons',
];

const SYSTEM = `You write cards for Hot Head, a Heads Up-style party game. One player holds the phone to their forehead without seeing the card; friends shout clues until they guess it.

Write items that a group of adults in their 20s at a house party would instantly recognise and could clue within a few seconds: well-known names, titles, things, places and phrases. Mix easy and medium; skip anything obscure, niche or that needs explaining.

Format, strictly:
- One item per line, nothing else: no numbering, bullets, quotes, emoji, headings, notes or blank lines.
- Title Case, at most 4 words, no subtitles or colons.
- No duplicates or near-duplicates, and no item that gives away another.`;

export function buildPrompt(theme: string, count: number, avoid: readonly string[]): string {
  const parts = [`Theme: ${theme.trim() || 'anything fun'}`, `Write ${count} items.`];
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
  signal: AbortSignal;
}

export async function generateWords(o: GenerateOptions): Promise<void> {
  const seen = new Set(o.avoid.map(itemKey));
  let n = 0;
  await streamLines({
    system: SYSTEM,
    prompt: buildPrompt(o.theme, o.count, o.avoid),
    signal: o.signal,
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
