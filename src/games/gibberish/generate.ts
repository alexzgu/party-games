// "🧙 Ask the wizard" for Inn Co Hear Ant: the prompt carries the quality bar, and each streamed
// line becomes a card the moment it arrives.
import { streamLines } from '../../lib/claude';
import type { GibberishCard, GibberishPack } from '../../lib/content';
import { morePrompt, streamMore, type MoreRun } from '../../lib/addMore';
import { answerKey, cardLine, parseLine } from './parse';
import type { ChangeGame } from '../../lib/wizardChange';
import { askedFor, withNameAsk } from '../../lib/wizardAsk';

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

/** The prompt for a batch from the player's `request`, never an answer in `avoid`; `named`: ask for a pack name too. */
export function buildPrompt(request: string, avoid: string[], named = false): string {
  let p = withNameAsk([askedFor(request, 'a mix of everything'), `Write ${BATCH} cards whose answers fit the request.`], named).join('\n');
  if (avoid.length) p += `\nThese answers are already in the pack, so do not use them again: ${avoid.join('; ')}.`;
  return p;
}

/** The category for a card that comes without one: a short request (a quick idea like "Movies") in Title Case, else none. */
export function fallbackCategory(request: string): string {
  const t = request.trim().replace(/\s+/g, ' ');
  return t.split(' ').length <= 3 && t.length <= 24 ? t.replace(/\b\w/g, (c) => c.toUpperCase()) : '';
}

/**
 * Streams new cards for the player's request, skipping duplicates of `existing` and of each
 * other. With `onName`, Fizzwick also suggests the pack's name, handed there.
 */
export async function generateCards(opts: {
  theme: string;
  existing: GibberishCard[];
  onCard: (c: GibberishCard) => void;
  onName?: (name: string) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const seen = new Set([...opts.existing.map(answerKey), ...EXAMPLES.map((e) => answerKey(parseLine(e)!))]);
  const category = fallbackCategory(opts.theme);
  await streamLines({
    system: SYSTEM,
    prompt: buildPrompt(opts.theme, opts.existing.map((c) => c.answer), !!opts.onName),
    signal: opts.signal,
    onName: opts.onName,
    onLine: (line) => {
      const card = parseLine(line, category);
      if (!card || seen.has(answerKey(card))) return;
      seen.add(answerKey(card));
      opts.onCard(card);
    },
  });
}

/** "Ask for changes" on the review of Fizzwick's cards: a run asks for `BATCH`, so a change does too. */
export const CHANGE: ChangeGame<GibberishCard> = {
  system: SYSTEM, maxTokens: 8000, max: BATCH,
  first: (request) => buildPrompt(request, []),
  line: cardLine, read: (line, request) => parseLine(line, fallbackCategory(request)), keyOf: answerKey,
  describe: (c) => `${c.all} cards`, avoidLine: (c) => c.answer, avoidKey: answerKey,
  taken: EXAMPLES.map((e) => answerKey(parseLine(e)!)),
};

/** "🧙 Add more" on a pack: how many cards to ask for. */
export const MORE_RANGE = { start: 10, min: 5, max: 30, step: 5 };

/** The category most of the pack's cards share, for a card that comes without one. */
function usualHint(cards: readonly GibberishCard[]): string {
  const n = new Map<string, number>();
  for (const c of cards) if (c.hint) n.set(c.hint, (n.get(c.hint) ?? 0) + 1);
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

/**
 * More cards on top of `pack`, never with an answer of its cards, of those already written this
 * time or of `others` (every other pack's cards: an answer is never in two packs).
 */
export function moreCards(pack: GibberishPack, others: readonly GibberishCard[], run: MoreRun<GibberishCard>): Promise<number> {
  const have = [...run.avoid, ...pack.cards];
  const hint = usualHint(pack.cards);
  return streamMore({
    system: SYSTEM,
    prompt: morePrompt({ name: pack.name, blurb: pack.blurb, have: have.map((c) => c.answer), others: others.map((c) => c.answer), listed: 'their answers' }, run, 'cards'),
    count: run.count, maxTokens: 4000, read: (line) => parseLine(line, hint), keyOf: answerKey,
    taken: [...have, ...others, ...EXAMPLES.map((e) => parseLine(e)!)].map(answerKey), onItem: run.onItem, signal: run.signal,
  });
}
