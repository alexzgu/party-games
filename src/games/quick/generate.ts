// "Ask Claude" for Brain Freeze: the system prompt carries the quality bar, and each streamed
// line becomes a prompt the moment it arrives.
import { streamLines } from '../../lib/claude';
import { morePrompt, streamMore, type MoreRun } from '../../lib/addMore';
import type { QuickPack } from '../../lib/content';
import { promptKey } from './logic';
import { cleanPrompt, promptError, promptLine } from './parse';
import type { ChangeGame } from '../../lib/wizardChange';
import { askedFor, withNameAsk } from '../../lib/wizardAsk';

export const THEME_CHIPS = ['Food & drink', 'Movies & TV', 'Music', 'Sports', 'Around the house', 'Animals', 'Travel', 'School & work', '2000s throwback', 'After dark'];

const BATCH = 30;

export const SYSTEM = `You write prompts for a fast party game. A player has 5 seconds to name 3 things that fit the prompt, out loud. The app shows each prompt after the words "Name 3", so you write only the part after them.

Output format: one prompt per line, nothing else. No numbering, no "Name 3", no quotes, no punctuation at the end, no commentary.

Examples:
things you'd find in a fridge
words that rhyme with night
songs by Taylor Swift
excuses for being late

Every prompt must meet all of these:
1. 2 to 8 words, starting with a lowercase word (names keep their capitals inside the prompt).
2. Easy to start, hard to finish in 5 seconds: everyone in the room knows at least 3 answers, but they are specific enough that people blank under pressure.
3. Players are adults in their 20s at a US house party. Widely known topics, no trivia that only experts know.
4. For cheeky or adult themes: cheeky, never explicit.
Mix easy and harder prompts. Never repeat a prompt or use the examples.`;

/** The prompt for a batch from the player's `request`, never one in `avoid`; `named`: ask for a pack name too. */
export function buildPrompt(request: string, avoid: string[], named = false): string {
  let p = withNameAsk([askedFor(request, 'a mix of everything'), `Write ${BATCH} prompts that fit the request.`], named).join('\n');
  if (avoid.length) p += `\nThese are already in the pack, so do not use them again: ${avoid.join('; ')}.`;
  return p;
}

/**
 * Streams new prompts for the player's request, skipping duplicates of `existing` and of each
 * other. With `onName`, Fizzwick also suggests the pack's name, handed there.
 */
export async function generatePrompts(opts: { theme: string; existing: string[]; onPrompt: (p: string) => void; onName?: (name: string) => void; signal?: AbortSignal }): Promise<void> {
  const seen = new Set(opts.existing.map(promptKey));
  await streamLines({
    system: SYSTEM,
    prompt: buildPrompt(opts.theme, opts.existing, !!opts.onName),
    signal: opts.signal,
    onName: opts.onName,
    onLine: (line) => {
      const p = cleanPrompt(line);
      if (!p || promptError(p, []) || seen.has(promptKey(p))) return;
      seen.add(promptKey(p));
      opts.onPrompt(p);
    },
  });
}

/** "🧙 Add more" on a pack: how many prompts to ask for. */
export const MORE_RANGE = { start: 15, min: 5, max: 40, step: 5 };

const readPrompt = (line: string) => {
  const p = cleanPrompt(line);
  return p && !promptError(p, []) ? p : null;
};

/** "Ask for changes" on the review of Fizzwick's prompts: a run asks for `BATCH`, so a change does too. */
export const CHANGE: ChangeGame<string> = {
  system: SYSTEM, maxTokens: 8000, max: BATCH,
  first: (request) => buildPrompt(request, []),
  line: promptLine, read: (line) => readPrompt(line), keyOf: promptKey,
  describe: (c) => `${c.all} prompts`, avoidLine: promptLine, avoidKey: promptKey,
};

/**
 * More prompts on top of `pack`, never one of its prompts, of those already written this time or
 * of `others` (every other pack's prompts: a prompt is never in two packs).
 */
export function morePrompts(pack: QuickPack, others: readonly string[], run: MoreRun<string>): Promise<number> {
  const have = [...run.avoid, ...pack.prompts];
  return streamMore({
    system: SYSTEM,
    prompt: morePrompt({ name: pack.name, blurb: pack.blurb, have, others }, run, 'prompts'),
    count: run.count, maxTokens: 3000, read: readPrompt, keyOf: promptKey, taken: [...have, ...others].map(promptKey), onItem: run.onItem, signal: run.signal,
  });
}
