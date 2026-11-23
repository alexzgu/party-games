// Splitting a list pack with more items in one list than the Community library takes into packs
// that each fit, when it is made, imported, added to, or by its editor's Split button.

/** `id`, or `id-2`, `id-3`, … : the first that `taken` does not claim. */
export function freshId(id: string, taken: (id: string) => boolean): string {
  if (!taken(id)) return id;
  let n = 2;
  while (taken(`${id}-${n}`)) n++;
  return `${id}-${n}`;
}

/** `name`, or `name (2)`, `name (3)`, … : the first that `taken` does not claim (any case). */
export function freshName(name: string, taken: (lowered: string) => boolean): string {
  if (!taken(name.toLowerCase())) return name;
  let n = 2;
  while (taken(`${name} (${n})`.toLowerCase())) n++;
  return `${name} (${n})`;
}

/** The lists of `pack` under `fields`. */
const listOf = (pack: object, field: string): unknown[] => {
  const l = (pack as Record<string, unknown>)[field];
  return Array.isArray(l) ? l : [];
};

/** How many packs `pack` takes so that no list is longer than `max`. */
export const partCount = (pack: object, fields: readonly string[], max: number): number =>
  Math.max(1, ...fields.map((f) => Math.ceil(listOf(pack, f).length / max)));

/**
 * `pack` as the packs it takes: itself, or its lists shared out evenly (the first part gets any
 * odd item), so each is playable with room to grow. The first keeps the id and name; `fresh` names
 * the others. Everything else, the share and library marks included, is on every part.
 */
export function splitPack<T extends object>(pack: T, fields: readonly string[], max: number, fresh: () => { id: string; name: string }): T[] {
  const n = partCount(pack, fields, max);
  if (n === 1) return [pack];
  return Array.from({ length: n }, (_, i) => {
    const at = (l: unknown[], k: number) => Math.ceil((k * l.length) / n);
    const lists = Object.fromEntries(fields.map((f) => { const l = listOf(pack, f); return [f, l.slice(at(l, i), at(l, i + 1))]; }));
    return { ...pack, ...lists, ...(i ? fresh() : {}) };
  });
}
