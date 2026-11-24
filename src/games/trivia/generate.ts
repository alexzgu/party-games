// "🧙 Ask the wizard" for Smarty Pants: multiple-choice questions. Each streamed line is kept only
// when it meets AGENTS.md's Smarty Pants rules (rules.ts, the content gate's) and is new to every
// Smarty Pants pack on the phone (src/lib/listWizard.ts).
import type { ListWizard } from '../../lib/listWizard';
import { TRIVIA_LISTS } from './rules';

export const THEME_CHIPS = ['A bit of everything', 'Science', 'History', 'Geography', 'Movies', 'TV', 'Music', 'Sports', 'Food and drink', 'Animals', 'Video games', 'The 2000s'];

/** "Make a pack": how many questions to ask for. */
export const MAKE_RANGE = { start: 30, min: 10, max: 60, step: 5 };
/** "🧙 Add more" on a pack: how many questions to ask for. */
export const MORE_RANGE = { start: 15, min: 5, max: 40, step: 5 };

export const SYSTEM = `You write questions for Smarty Pants, a multiple-choice trivia game played on phones at a party. Each question has one right answer and three wrong ones; the app shuffles the four answers.

Write one question per line and nothing else (no numbering, headings, quotes, blank lines or commentary), each starting with "Question: ", then six parts split by " | " (a bar with a space on each side): category | question | the right answer | wrong answer | wrong answer | wrong answer
Question: Science | What gas do plants take in from the air? | Carbon dioxide | Oxygen | Nitrogen | Helium
Question: Geography | Which river flows through Cairo? | The Nile | The Amazon | The Danube | The Ganges

Every question must meet all of these:
1. Exactly six parts, none empty; a part never contains a bar.
2. Category: 1 to 3 words, at most 24 characters, starting with a capital. Question: 3 to 30 words, at most 140 characters, starting with a capital. Each answer: 1 to 6 words, at most 40 characters; the four answers all different.
3. Facts that are certain and will not change: no records, no "current" holders of a title or office, no populations, prices or rankings, nothing disputed or recent. Leave out anything you are not sure of.
4. Exactly one right answer: no wrong answer that is also true or arguably true.
5. Wrong answers of the same kind and about the same length as the right one (four rivers, four years, four actors), so the right one never stands out.
6. A spread of categories (at least four in any batch, unless the theme is one subject), easy to hard; players are adults in their 20s at a US house party.
Never repeat a question or use the examples.`;

export const WIZARD: ListWizard = { specs: TRIVIA_LISTS, system: SYSTEM, labels: { questions: 'Question' }, split: (count) => ({ questions: count }) };
