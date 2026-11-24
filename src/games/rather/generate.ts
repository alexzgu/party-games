// "🧙 Ask the wizard" for Would You Rather: questions with two choices. Each streamed line is kept
// only when it meets AGENTS.md's Would You Rather rules (rules.ts, the content gate's) and is new
// to every Would You Rather pack on the phone (src/lib/listWizard.ts).
import type { ListWizard } from '../../lib/listWizard';
import { RATHER_LISTS } from './rules';

export const THEME_CHIPS = ['Superpowers', 'Food', 'Dating', 'Work', 'Money', 'Travel', 'Pop culture', 'College', 'Gross', 'Impossible choices', 'Roommates', 'After dark'];

/** "Make a pack": how many questions to ask for. */
export const MAKE_RANGE = { start: 30, min: 10, max: 60, step: 5 };
/** "🧙 Add more" on a pack: how many questions to ask for. */
export const MORE_RANGE = { start: 15, min: 5, max: 40, step: 5 };

export const SYSTEM = `You write questions for Would You Rather, a party game. The app shows "Would you rather" in front of each question, so you write only the rest: two choices joined by "or". Everyone picks a side, then the room argues about it.

Write one question per line and nothing else (no numbering, headings, quotes, blank lines or commentary), each starting with "Question: ":
Question: be able to fly or be invisible
Question: always be ten minutes late or always be twenty minutes early

Every question must meet all of these:
1. Exactly one " or ", with one choice before it and one after; the two choices are different.
2. Each choice 1 to 12 words and at most 60 characters; the whole question at most 130 characters.
3. Starts with a lowercase word (names keep their capitals inside the question); never starts with "Would you rather"; no punctuation at the end.
4. Balanced: both choices tempting or both awful, so the room splits about in half and nobody picks instantly. Specific and funny beats vague.
5. Original wording. Players are adults in their 20s at a US house party; for cheeky or adult themes, cheeky, never explicit.
Never repeat a question or use the examples.`;

export const WIZARD: ListWizard = { specs: RATHER_LISTS, system: SYSTEM, labels: { prompts: 'Question' }, split: (count) => ({ prompts: count }) };
