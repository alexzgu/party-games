// "🧙 Ask the wizard" for Bad Hand: prompt cards and answer cards, about four answers per prompt.
// Each streamed line is kept only when it meets AGENTS.md's Bad Hand rules (rules.ts, the content
// gate's) and is new to every Bad Hand pack on the phone (src/lib/listWizard.ts).
import type { ListWizard } from '../../lib/listWizard';
import { HAND_LISTS } from './rules';

export const THEME_CHIPS = ['Office life', 'Roommates', 'Dating apps', 'Family dinners', 'Group chats', 'College', 'Weddings', 'The gym', 'Road trips', 'Holidays', 'Pets', 'After dark'];

/** "Make a pack": how many prompts to ask for (answers: four per prompt). */
export const MAKE_RANGE = { start: 20, min: 5, max: 40, step: 5 };
/** "🧙 Add more" on a pack: how many prompts to ask for. */
export const MORE_RANGE = { start: 10, min: 5, max: 30, step: 5 };

export const SYSTEM = `You write cards for Bad Hand, a party game in the style of Cards Against Humanity. A judge reads a prompt card; everyone else plays the answer card from their hand that fills it in the funniest way.

Write one card per line and nothing else (no numbering, headings, quotes, blank lines or commentary), each starting with its kind:
Prompt: My therapist says my biggest problem is ___
Prompt: What got me kicked out of the group chat?
Prompt: ___ and ___: the two pillars of dorm life
Answer: A suspiciously large rice cooker

Prompts: a blank is exactly three underscores, ___; at most two blanks (about one prompt in six has two); a prompt with no blank is a question ending in "?". Capital first, 3 to 20 words, at most 140 characters.
Answers: 1 to 10 words, at most 60 characters, sentence case (capital first), no full stop at the end, mostly noun phrases ("My dad's fantasy football league") so one answer fits many prompts.
Original wording, never Cards Against Humanity's own cards. Players are adults in their 20s at a US house party: edgy and cheeky, never explicit, no slurs and no punching down at groups.
Never repeat a card or use the examples.`;

export const WIZARD: ListWizard = {
  specs: HAND_LISTS,
  system: SYSTEM,
  labels: { prompts: 'Prompt', answers: 'Answer' },
  split: (count) => ({ prompts: count, answers: count * 4 }),
};
