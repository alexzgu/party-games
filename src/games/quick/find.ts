// Brain Freeze's packs in the shared pack list, and search and sort for a pack's prompts.
import { customQuick, type QuickPack } from '../../lib/content';
import { matches, sorted, type SortKey } from '../../lib/listing';
import { counted, packTag, type PackEntry } from '../../lib/packList';

/** A pack as the setup's pack list shows it. */
export const packEntry = (p: QuickPack): PackEntry => ({
  id: p.id, name: p.name, blurb: p.blurb, added: p.added,
  size: p.prompts.length, sizeLabel: counted(p.prompts.length, 'prompts'), tag: packTag(p.custom, customQuick.isEdited(p.id)),
  items: p.prompts.map((label) => ({ label })),
});

/** A pack's prompts to show, each with its index in the pack. The editor puts new prompts first, so a lower index is newer. */
export function findPrompts(prompts: string[], query: string, sort: SortKey) {
  const found = prompts.map((q, i) => ({ q, i })).filter((x) => matches(x.q, query));
  return sorted(found, sort, (x) => x.q, (x) => -x.i);
}
