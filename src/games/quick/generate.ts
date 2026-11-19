// "Ask Claude" for Brain Freeze: the system prompt carries the quality bar, and each streamed
// line becomes a prompt the moment it arrives.
import { streamLines } from '../../lib/claude';
import { promptKey } from './logic';
import { cleanPrompt, promptError } from './parse';

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

export function buildPrompt(theme: string, avoid: string[]): string {
  let p = `Theme: ${theme.trim() || 'a mix of everything'}\nWrite ${BATCH} prompts that fit the theme.`;
  if (avoid.length) p += `\nThese are already in the pack, so do not use them again: ${avoid.join('; ')}.`;
  return p;
}

/** Streams new prompts for a theme, skipping duplicates of `existing` and of each other. */
export async function generatePrompts(opts: { theme: string; existing: string[]; onPrompt: (p: string) => void; signal?: AbortSignal }): Promise<void> {
  const seen = new Set(opts.existing.map(promptKey));
  await streamLines({
    system: SYSTEM,
    prompt: buildPrompt(opts.theme, opts.existing),
    signal: opts.signal,
    onLine: (line) => {
      const p = cleanPrompt(line);
      if (!p || promptError(p, []) || seen.has(promptKey(p))) return;
      seen.add(promptKey(p));
      opts.onPrompt(p);
    },
  });
}
