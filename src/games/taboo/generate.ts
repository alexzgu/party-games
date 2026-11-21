// "🧙 Ask the wizard" for Don't Say It: the system prompt carries the quality bar, and each
// streamed `Word: one, two, three, four, five` line becomes a card the moment it arrives, kept
// only when it passes the same rules as every other card (cards.ts) and its word is new.
import { MAX_LISTED_CHARS, morePrompt, streamMore, within, type MoreRun } from '../../lib/addMore';
import type { TabooCard, TabooPack } from '../../lib/content';
import { cardId, key, parseCards } from './cards';

export const THEME_CHIPS = ['Food & drink', 'Movies & TV', 'Music', 'Sports', 'Around the house', 'Animals', 'Travel', 'School & work', '2000s throwback', 'After dark'];

/** "Make a pack": how many cards to ask for. */
export const MAKE_RANGE = { start: 30, min: 10, max: 60, step: 5 };
/** "🧙 Add more" on a pack: how many cards to ask for. */
export const MORE_RANGE = { start: 15, min: 5, max: 40, step: 5 };

export const SYSTEM = `You write cards for Don't Say It, a party game in the style of Taboo. Two teams take turns; the describer gets their team to say the word on the card without saying the word itself or any of the five banned words under it.

Output format: one card per line, nothing else, exactly as
Word: Banned one, Banned two, Banned three, Banned four, Banned five
No numbering, headings, quotes, blank lines or commentary.

Examples:
Pizza: Cheese, Slice, Pepperoni, Italian, Delivery
Beach: Sand, Ocean, Waves, Sunscreen, Towel

Every card must meet all of these:
1. The word is something most of the room knows: players are adults in their 20s at a US house party. 1 to 3 words; Title Case for names ("Taylor Swift"), sentence case otherwise ("Road trip").
2. Exactly 5 banned words, each 1 to 3 words and all different: the five most obvious clues, the first things anyone would say to describe the word, so the game is hard in the fun way.
3. No banned word contains the word or sits inside it ("Pizza" cannot ban "Pizzas" or "Pizza slice").
4. For cheeky or adult themes: cheeky, never explicit.
Never repeat a word or use the examples.`;

/** The request for `count` cards on `theme`, never using any word in `avoid`. */
export function buildPrompt(theme: string, count: number, avoid: readonly string[]): string {
  const parts = [`Theme: ${theme.trim() || 'a mix of everything'}`, `Write ${count} cards that fit the theme.`];
  const listed = within(avoid, MAX_LISTED_CHARS);
  if (listed.length) parts.push(`These words are already on cards, so never use them again:\n${listed.join('\n')}`);
  return parts.join('\n\n');
}

/** One streamed line to a card, or null when it is not a valid one (cards.ts decides). */
export function readCard(line: string): TabooCard | null {
  return parseCards(line.replace(/[.;]+\s*$/, '')).cards[0] ?? null;
}

/**
 * Streams up to `count` new cards on a theme, never one whose word is in `avoid` (every word
 * on the phone and on screen: a word is never in two packs) or repeated.
 */
export function generateCards(o: { theme: string; count: number; avoid: readonly string[]; onCard: (c: TabooCard) => void; signal?: AbortSignal }): Promise<number> {
  return streamMore({
    system: SYSTEM, prompt: buildPrompt(o.theme, o.count, o.avoid),
    count: o.count, maxTokens: 4000, read: readCard, keyOf: cardId, taken: o.avoid.map(key), onItem: o.onCard, signal: o.signal,
  });
}

/** More cards on top of `pack`, never a word of its own, of those already written this time or of `others` (every other pack's words). */
export function moreCards(pack: TabooPack, others: readonly string[], run: MoreRun<TabooCard>): Promise<number> {
  const have = [...run.avoid, ...pack.cards].map((c) => c.word);
  return streamMore({
    system: SYSTEM,
    prompt: morePrompt({ name: pack.name, blurb: pack.blurb, have, others, listed: 'their words' }, run, 'cards'),
    count: run.count, maxTokens: 4000, read: readCard, keyOf: cardId, taken: [...have, ...others].map(key), onItem: run.onItem, signal: run.signal,
  });
}
