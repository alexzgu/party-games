// Sketchy's packs in the shared pack list.
import { customSketch, type SketchPack } from '../../lib/content';
import { listEntry } from '../../lib/listPack';
import type { PackEntry } from '../../lib/packList';
import type { Mode } from './core';
import { SKETCH_LISTS } from './rules';

/** A pack as the game settings' pack list shows it, counting what the mode deals: "300 words" or "100 ideas". */
export const packEntry = (p: SketchPack, mode: Mode): PackEntry =>
  listEntry(SKETCH_LISTS, p, customSketch.isEdited(p.id), mode === 'telephone' ? 'ideas' : 'words');
