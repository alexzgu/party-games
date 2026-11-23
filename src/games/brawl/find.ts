// Doodle Brawl's packs in the shared pack list.
import { customBrawl, type BrawlPack } from '../../lib/content';
import { listEntry } from '../../lib/listPack';
import type { PackEntry } from '../../lib/packList';
import { BRAWL_LISTS } from './rules';

/** A pack as the game settings' pack list shows it: "60 titles". */
export const packEntry = (p: BrawlPack): PackEntry => listEntry(BRAWL_LISTS, p, customBrawl.isEdited(p.id));
