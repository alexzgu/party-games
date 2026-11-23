// Bad Hand's packs in the shared pack list.
import { customHand, type HandPack } from '../../lib/content';
import { listEntry } from '../../lib/listPack';
import type { PackEntry } from '../../lib/packList';
import { HAND_LISTS } from './rules';

/** A pack as the game settings' pack list shows it: "30 prompts · 120 answers". */
export const packEntry = (p: HandPack): PackEntry => listEntry(HAND_LISTS, p, customHand.isEdited(p.id));
