// Would You Rather's packs in the shared pack list.
import { customRather, type RatherPack } from '../../lib/content';
import { listEntry } from '../../lib/listPack';
import type { PackEntry } from '../../lib/packList';
import { RATHER_LISTS } from './rules';

/** A pack as the game settings' pack list shows it: "60 questions". */
export const packEntry = (p: RatherPack): PackEntry => listEntry(RATHER_LISTS, p, customRather.isEdited(p.id));
