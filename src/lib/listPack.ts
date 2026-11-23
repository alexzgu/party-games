// Packs made of plain text lists (Doodle Brawl: titles; Bad Hand: prompts and answers; Sketchy:
// words and ideas): each list's rules, and the changes the pack editor, "Make a pack" and the
// wizard make to such a pack. Each game describes its lists once (`ListSpec`, in its rules.ts);
// pack files (packfile.ts) check items with the same specs, so every route keeps the same rules.
import { pastedLines } from './paste';
import { matches, sorted, type SortKey } from './listing';
import { counted, packTag, type PackEntry } from './packList';
import { SHAPE } from './libraryShape';
import { checked, type ListSpec } from './listSpec';

export { checked, type ListSpec };

/** Items one list of a pack holds, at most: what the Community library takes. */
export const LIST_MAX = SHAPE.itemsMax;

/** An item of one list, as the wizard and paste hand them over. */
export interface ListItem { field: string; text: string }

/** A list pack: the lists are string arrays under their fields (`ListSpec.field`). */
export interface ListPack { id: string; name: string; blurb: string }

export function listOf(pack: ListPack, field: string): string[] {
  const list = (pack as unknown as Record<string, unknown>)[field];
  return Array.isArray(list) ? (list as string[]) : [];
}

const specOf = (specs: readonly ListSpec[], field: string): ListSpec => specs.find((s) => s.field === field) ?? specs[0];

/** The item's key across lists: the same text in two lists is two items. */
export const itemKey = (specs: readonly ListSpec[]) => (i: ListItem): string => `${i.field}:${specOf(specs, i.field).key(i.text)}`;

/** Every item the pack has, as list items. */
export const packItems = (specs: readonly ListSpec[], pack: ListPack): ListItem[] =>
  specs.flatMap((s) => listOf(pack, s.field).map((text) => ({ field: s.field, text })));

/** `kept` on top of each of the pack's lists, leaving out any the pack already has or repeated. */
export function addItems<P extends ListPack>(pack: P, specs: readonly ListSpec[], kept: readonly ListItem[]): P {
  const key = itemKey(specs);
  const taken = new Set(packItems(specs, pack).map(key));
  const fresh = kept.filter((i) => !taken.has(key(i)) && !!taken.add(key(i)));
  const next: Record<string, unknown> = { ...pack } as Record<string, unknown>;
  for (const s of specs) next[s.field] = [...fresh.filter((i) => i.field === s.field).map((i) => i.text), ...listOf(pack, s.field)];
  return next as P;
}

/** Item `at` of `field` (or a new one, first) set to `text`. */
export function setItem<P extends ListPack>(pack: P, field: string, at: number | 'new', text: string): P {
  const list = listOf(pack, field);
  return { ...pack, [field]: at === 'new' ? [text, ...list] : list.map((x, i) => (i === at ? text : x)) } as P;
}

/** The pack without item `at` of `field`. */
export function removeItem<P extends ListPack>(pack: P, field: string, at: number): P {
  return { ...pack, [field]: listOf(pack, field).filter((_, i) => i !== at) } as P;
}

/** Why `text` cannot be item `at` of `field` (another item there is the same), or ''. */
export function editProblem(pack: ListPack, spec: ListSpec, at: number | 'new', text: string): string {
  if (!text) return `Type a ${spec.one} first.`;
  const why = spec.problem(text);
  if (why) return `That ${spec.one} cannot be used: ${why}.`;
  if (at === 'new' && listOf(pack, spec.field).length >= LIST_MAX) return `This pack already has ${LIST_MAX} ${spec.many}, the most a pack holds.`;
  const k = spec.key(text);
  return listOf(pack, spec.field).some((x, i) => i !== at && spec.key(x) === k) ? `That ${spec.one} is already in this pack.` : '';
}

/**
 * A pasted list, one item per line (numbers, bullets and quotes dropped), each line put in the
 * list `route` names; plus why any line was skipped ("too long", "repeated").
 */
export function parseLists(text: string, specs: readonly ListSpec[], route: (line: string) => string): { items: ListItem[]; skipped: string[] } {
  const skipped: string[] = [];
  const items: ListItem[] = [];
  const key = itemKey(specs);
  const seen = new Set<string>();
  for (const line of pastedLines(text)) {
    const raw = line.replace(/^(\d+[.)]|[-*•])\s+/, '').replace(/^["“](.*)["”]$/, '$1').trim();
    if (!raw) continue;
    const spec = specOf(specs, route(raw));
    const t = spec.tidy(raw.replace(/\s+/g, ' '));
    const why = t ? spec.problem(t) : 'empty';
    if (why) { skipped.push(specs.length > 1 ? `${spec.one} ${why}` : why); continue; }
    const item = { field: spec.field, text: t };
    if (seen.has(key(item))) { skipped.push('repeated'); continue; }
    seen.add(key(item));
    items.push(item);
  }
  return { items, skipped };
}

/** "30 prompts · 120 answers" (a single list: "60 titles"). */
export const sizeLine = (specs: readonly ListSpec[], pack: ListPack): string =>
  specs.map((s) => { const n = listOf(pack, s.field).length; return `${n} ${n === 1 ? s.one : s.many}`; }).join(' · ');

/** A list's items matching `query`, in the chosen order, with their index (new items go first, so a lower index is newer). */
export function findItems(list: readonly string[], query: string, sort: SortKey): { text: string; i: number }[] {
  const found = list.map((text, i) => ({ text, i })).filter((x) => matches(x.text, query));
  return sorted(found, sort, (x) => x.text, (x) => -x.i);
}

/**
 * A list pack as the game settings' pack list shows it; `size` is the list it counts (Sketchy: the
 * mode's), every list when not given.
 */
export function listEntry(specs: readonly ListSpec[], pack: ListPack & { custom?: boolean; added?: string }, edited: boolean, size?: string): PackEntry {
  const counts = specs.filter((s) => !size || s.field === size);
  const n = counts.reduce((sum, s) => sum + listOf(pack, s.field).length, 0);
  return {
    id: pack.id, name: pack.name, blurb: pack.blurb, added: pack.added,
    size: n, sizeLabel: size ? counted(n, counts[0].many) : sizeLine(specs, pack), tag: packTag(pack.custom, edited),
    items: specs.flatMap((s) => listOf(pack, s.field).map((label) => ({ label }))),
  };
}
