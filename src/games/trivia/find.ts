// Smarty Pants's packs in the shared pack list.
import { customTrivia, type TriviaPack } from '../../lib/content';
import { listEntry } from '../../lib/listPack';
import type { PackEntry } from '../../lib/packList';
import { TRIVIA_LISTS } from './rules';

/** A pack as the game settings' pack list shows it: "60 questions". */
export const packEntry = (p: TriviaPack): PackEntry => listEntry(TRIVIA_LISTS, p, customTrivia.isEdited(p.id));
