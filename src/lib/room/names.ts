// How the own-phones games tell players' names apart. Two names with the same key look the same on
// a screen, so no two players who may still play (present, or gone and free to come back) hold them.

/** A name as it looks: compatibility forms folded, invisible characters dropped, spaces trimmed and collapsed, case ignored. */
export const nameKey = (name: string): string =>
  name.normalize('NFKC').replace(/\p{Cf}/gu, '').trim().replace(/\s+/g, ' ').toLowerCase();

/** The player among `held` whose name looks the same as `name`, if any. */
export const sameName = <P extends { name: string }>(held: readonly P[], name: string): P | undefined => {
  const key = nameKey(name);
  return held.find((p) => nameKey(p.name) === key);
};
