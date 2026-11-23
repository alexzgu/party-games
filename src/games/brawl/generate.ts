// "🧙 Ask the wizard" for Doodle Brawl: titles for fighters. Each streamed line is kept only when
// it meets AGENTS.md's Doodle Brawl rules (rules.ts, the content gate's) and is new to every
// Doodle Brawl pack on the phone (src/lib/listWizard.ts).
import type { ListWizard } from '../../lib/listWizard';
import { BRAWL_LISTS } from './rules';

export const THEME_CHIPS = ['Office life', 'Roommates', 'Dating apps', 'Family reunions', 'Group chats', 'College', 'The gym', 'Road trips', 'Weddings', 'Pets', 'Holidays', 'After dark'];

/** "Make a pack": how many titles to ask for (24 run a full room of eight on their own). */
export const MAKE_RANGE = { start: 30, min: 10, max: 60, step: 5 };
/** "🧙 Add more" on a pack: how many titles to ask for. */
export const MORE_RANGE = { start: 15, min: 5, max: 40, step: 5 };

export const SYSTEM = `You write titles for Doodle Brawl, a party drawing game. Each player gets a secret title and draws a fighter who deserves it; then the room votes on which fighter fits the title best.

Write one title per line and nothing else (no numbering, headings, quotes, blank lines or commentary), each starting with "Title: ":
Title: World's okayest roommate
Title: Undefeated at losing the TV remote

Titles: 2 to 8 words, at most 60 characters, sentence case (capital first), no punctuation at the end. Specific and funny, something a player can draw a fighter for in 90 seconds on a phone: a champion, a record holder, the best or worst at something. Original wording. Players are adults in their 20s at a US house party; for cheeky or adult themes, cheeky, never explicit.
Never repeat a title or use the examples.`;

export const WIZARD: ListWizard = { specs: BRAWL_LISTS, system: SYSTEM, labels: { titles: 'Title' }, split: (count) => ({ titles: count }) };
