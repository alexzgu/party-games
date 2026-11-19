// Search and sort for the pack list and a pack's prompts.
import { packAge, type SnarkPack } from '../../lib/content';
import { matches, sorted, type SortKey } from '../../lib/listing';

/** Whether a pack matches, and, when only some prompts do, a line saying which. */
export function packHit(p: SnarkPack, query: string): { match: boolean; hit: string } {
  if (matches(p.name, query) || matches(p.blurb, query)) return { match: true, hit: '' };
  const found = p.prompts.filter((q) => matches(q, query));
  if (!found.length) return { match: false, hit: '' };
  return { match: true, hit: `has “${found[0]}”${found.length > 1 ? ` and ${found.length - 1} more` : ''}` };
}

export function findPacks(packs: SnarkPack[], query: string, sort: SortKey) {
  const found = packs.map((p) => ({ p, ...packHit(p, query) })).filter((x) => x.match);
  return sorted(found, sort, (x) => x.p.name, (x) => packAge(x.p));
}

/** A pack's prompts with their index; new prompts go first, so a lower index is newer. */
export function findPrompts(prompts: string[], query: string, sort: SortKey) {
  const found = prompts.map((q, i) => ({ q, i })).filter((x) => matches(x.q, query));
  return sorted(found, sort, (x) => x.q, (x) => -x.i);
}
