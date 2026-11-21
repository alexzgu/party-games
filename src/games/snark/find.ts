// Snark Tank's packs in the shared pack list, and search and sort for a pack's prompts.
import { customSnark, type SnarkPack } from '../../lib/content';
import { matches, sorted, type SortKey } from '../../lib/listing';
import { counted, packTag, type PackEntry } from '../../lib/packList';

/** A pack as the game settings' pack list shows it. */
export const packEntry = (p: SnarkPack): PackEntry => ({
  id: p.id, name: p.name, blurb: p.blurb, added: p.added,
  size: p.prompts.length, sizeLabel: counted(p.prompts.length, 'prompts'), tag: packTag(p.custom, customSnark.isEdited(p.id)),
  items: p.prompts.map((label) => ({ label })),
});

/** A pack's prompts with their index; new prompts go first, so a lower index is newer. */
export function findPrompts(prompts: string[], query: string, sort: SortKey) {
  const found = prompts.map((q, i) => ({ q, i })).filter((x) => matches(x.q, query));
  return sorted(found, sort, (x) => x.q, (x) => -x.i);
}
