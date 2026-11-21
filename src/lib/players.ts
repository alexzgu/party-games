/** The default name for a new player: "Player N", N one past the list length, or the next free N after it. */
export function nextPlayerName(names: string[]): string {
  const taken = new Set(names.map((n) => n.toLowerCase()));
  let n = names.length + 1;
  while (taken.has(`player ${n}`)) n++;
  return `Player ${n}`;
}

/**
 * A saved game's players after its setup list was edited (players added, renamed or removed).
 * `seats[i]` is the old place of the list's player i, or -1 for one added in setup; `places[k]`
 * is the new place of old player k, or -1 when they were removed.
 */
export interface Reseat { names: string[]; seats: number[]; places: number[] }

export function reseating(names: readonly string[], seats: readonly number[], before: number): Reseat {
  const places = Array.from({ length: before }, () => -1);
  seats.forEach((from, i) => { if (from >= 0 && from < before) places[from] = i; });
  return { names: [...names], seats: [...seats], places };
}

/** True when the edit leaves the saved players exactly as they were. */
export function unchanged(r: Reseat, oldNames: readonly string[]): boolean {
  return r.names.length === oldNames.length && r.names.every((n, i) => r.seats[i] === i && n === oldNames[i]);
}

/** The new place of the first player still in, going round from old place `from` (0 when none is). */
export function nextKept(r: Reseat, from: number): number {
  const n = r.places.length;
  for (let k = 0; k < n; k++) {
    const to = r.places[(from + k) % n];
    if (to >= 0) return to;
  }
  return 0;
}
