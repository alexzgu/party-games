// "🧙 Ask the wizard" for Sketchy: words to draw for Draw & guess and ideas that start a
// Telephone chain, about one idea per three words. Each streamed line is kept only when it meets
// AGENTS.md's Sketchy rules (rules.ts, the content gate's) and is new to every Sketchy pack on the
// phone (src/lib/listWizard.ts).
import type { ListWizard } from '../../lib/listWizard';
import { SKETCH_LISTS } from './rules';

export const THEME_CHIPS = ['Movies and TV', 'Food', 'Animals', 'Sports', 'Office life', 'Camping', 'The beach', 'Holidays', 'College', 'Music', 'Video games', 'After dark'];

/** "Make a pack": how many words to ask for (ideas: one per three). */
export const MAKE_RANGE = { start: 45, min: 15, max: 120, step: 15 };
/** "🧙 Add more" on a pack: how many words to ask for. */
export const MORE_RANGE = { start: 30, min: 15, max: 90, step: 15 };
/** Ideas to ask for with `words` words: one per three, at least five. */
export const ideasFor = (words: number): number => Math.max(5, Math.round(words / 3));

export const SYSTEM = `You write content for Sketchy, a party drawing game played on phones. In Draw & guess one player draws a word while the others race to guess it; in Telephone a chain starts with an idea, then players take turns drawing what they were handed and describing the drawing they were handed.

Write one item per line and nothing else (no numbering, headings, quotes, blank lines or commentary), each starting with its kind:
Word: Bunk bed
Word: Ramen
Idea: A raccoon cramming for finals

Words: 1 to 3 words, letters, spaces, hyphens and apostrophes only (no digits or other symbols), at most 24 characters, sentence case. Things most of the room knows and could draw in 80 seconds on a phone: objects, animals, places, actions, famous things. About 60% easy, 30% medium, 10% hard.
Ideas: 3 to 10 words, at most 70 characters, capital first, no punctuation at the end. A funny, specific scene someone can draw ("A cat filing its taxes").
Original wording. Players are adults in their 20s at a US house party; for cheeky or adult themes, cheeky, never explicit.
Never repeat an item or use the examples.`;

export const WIZARD: ListWizard = {
  specs: SKETCH_LISTS,
  system: SYSTEM,
  labels: { words: 'Word', ideas: 'Idea' },
  split: (count) => ({ words: count, ideas: ideasFor(count) }),
};
