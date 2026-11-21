// The pack list every pack game shows on its setup (components/PackList.svelte): what one pack
// looks like there, how the list is searched, and how picks change. Each game maps its packs
// to `PackEntry` (its find.ts); everything after that is shared.
import { packAge } from './content';
import { matches, sorted, type SortKey } from './listing';

/** Tiles (a two-column grid) or rows (one full-width line each); one choice for every game. */
export type PackView = 'tiles' | 'rows';

/** One searchable thing inside a pack: `label` is what a search hit names, `text` all it matches on. */
export interface PackItem { label: string; text?: string }

export interface PackEntry {
  id: string;
  name: string;
  blurb: string;
  /** Built-ins without one count as the oldest. */
  added?: string;
  /** Heads Down. only: the pack's one-character icon. */
  icon?: string;
  /** How many items the pack holds, for the header's total. */
  size: number;
  /** The size as shown on the pack ("60 words", Big Board "5 × 5"). */
  sizeLabel: string;
  tag?: 'Mine' | 'Edited';
  /** Rows only: more about what is inside (Big Board: its category names). */
  details?: string;
  /** A problem to flag in the pack's colour for warnings (Big Board: "3 empty"). */
  warn?: string;
  /** In search order: a hit names the first item whose label matches, else the first that matches at all. */
  items: readonly PackItem[];
}

export interface PackHit { entry: PackEntry; hit: string }

/** "Mine" for the player's own pack, "Edited" for a built-in changed on this phone. */
export const packTag = (custom: boolean | undefined, edited: boolean): PackEntry['tag'] =>
  custom ? 'Mine' : edited ? 'Edited' : undefined;

/** "1 word", "60 words": `noun` is the plural. */
export const counted = (n: number, noun: string): string => `${n} ${n === 1 ? noun.replace(/s$/, '') : noun}`;

/**
 * How a pack matches a search: null when it does not, '' when its name or blurb does, else a
 * line naming an item inside (`has “Ice Cream”`, `has “Ice Cream” and 2 more`).
 */
export function hitLine(entry: PackEntry, query: string): string | null {
  if (matches(entry.name, query) || matches(entry.blurb, query)) return '';
  const found = entry.items.filter((x) => matches(x.text ?? x.label, query));
  if (!found.length) return null;
  const first = found.find((x) => matches(x.label, query)) ?? found[0];
  const more = found.length - 1;
  return `has “${first.label}”${more ? ` and ${more} more` : ''}`;
}

/** The packs to show, in the chosen order, each with its hit line. */
export function findEntries(entries: readonly PackEntry[], query: string, sort: SortKey): PackHit[] {
  return sorted(entries, sort, (e) => e.name, packAge).flatMap((entry) => {
    const hit = hitLine(entry, query);
    return hit === null ? [] : [{ entry, hit }];
  });
}

/** A tap on a pack: multi-pick ticks or unticks it; single pick (Big Board) picks it. */
export function tapped(selected: readonly string[], id: string, single: boolean): string[] {
  if (single) return [id];
  return selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
}

/**
 * The picks after an import: the imported packs on their own, like a pack just made (single
 * pick: the first of them); `keep` (Snark Tank) adds them to the packs already picked instead.
 */
export function afterImport(selected: readonly string[], ids: readonly string[], single: boolean, keep = false): string[] {
  if (!ids.length) return [...selected];
  if (single) return [ids[0]];
  if (keep) return [...ids.filter((id) => !selected.includes(id)), ...selected];
  return [...ids];
}

/** The header's count of what is picked, hidden packs included: "2 picked · 320 words". */
export function pickedLine(entries: readonly PackEntry[], selected: readonly string[], noun: string, single: boolean): string {
  const picked = entries.filter((e) => selected.includes(e.id));
  if (!picked.length) return single ? 'pick one' : 'pick one or more';
  const items = counted(picked.reduce((n, e) => n + e.size, 0), noun);
  return single ? items : `${picked.length} picked · ${items}`;
}
