// "Make with Claude" for Inn Co Hear Ant: the prompt carries the quality bar, and each streamed
// line becomes a card the moment it arrives.
import { streamLines } from '../../lib/claude';
import type { GibberishCard } from '../../lib/content';
import { answerKey, parseLine } from './parse';

export const THEME_CHIPS = ['Movies', 'Famous people', 'Food & drink', 'Songs', 'TV shows', 'Brands', 'Places', 'Sayings', 'Animals', '2000s throwback'];

const BATCH = 24;

const EXAMPLES = [
  'Eye Scream | Ice Cream | Food',
  'Hair Eye Pot Her | Harry Potter | Character',
  'Sand A Claws | Santa Claus | Holiday',
];

export const SYSTEM = `You write cards for a party game in the style of Mad Gab. Each card is a phrase of real but unrelated English words that, read aloud at normal speed, sounds like something well known: the answer. One player reads the phrase out loud and the others shout what it sounds like.

Output format: one card per line, exactly
Phrase | Answer | Category
No numbering, no header, no blank lines, no commentary before or after.

Examples:
${EXAMPLES.join('\n')}

Every card must meet all of these:
1. Every word in the phrase is a real English dictionary word. No invented spellings (not "Thuh", "Kwik" or "Fone").
2. The phrase contains none of the answer's words, not even in a different form.
3. Said aloud at normal speed, the phrase clearly sounds like the answer. Say it in your head first; if a group would not hear the answer within a few readings, leave the card out.
4. The answer is widely known to adults in their 20s in the US and UK: famous people, films, shows, songs, brands, places, foods, sayings, everyday things. No obscure trivia.
5. The phrase is 2 to 7 words in Title Case, and splits the sounds across word boundaries in surprising places.
6. The category is 1 to 3 words naming what kind of thing the answer is (Movie, Food, Singer, Saying). It never hints at the answer itself.
Mix easy and harder cards. Never repeat an answer or use the example answers.`;

export function buildPrompt(theme: string, avoid: string[]): string {
  const t = theme.trim() || 'a mix of everything';
  let p = `Theme: ${t}\nWrite ${BATCH} cards whose answers fit the theme.`;
  if (avoid.length) p += `\nThese answers are already in the pack, so do not use them again: ${avoid.join('; ')}.`;
  return p;
}

/** Streams new cards for a theme, skipping duplicates of `existing` and of each other. */
export async function generateCards(opts: {
  theme: string;
  existing: GibberishCard[];
  onCard: (c: GibberishCard) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const seen = new Set([...opts.existing.map(answerKey), ...EXAMPLES.map((e) => answerKey(parseLine(e)!))]);
  const category = opts.theme.trim().replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 24);
  await streamLines({
    system: SYSTEM,
    prompt: buildPrompt(opts.theme, opts.existing.map((c) => c.answer)),
    signal: opts.signal,
    onLine: (line) => {
      const card = parseLine(line, category);
      if (!card || seen.has(answerKey(card))) return;
      seen.add(answerKey(card));
      opts.onCard(card);
    },
  });
}
