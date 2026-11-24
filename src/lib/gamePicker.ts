// The app's drop-down (components/Dropdown.svelte: the game picker, the Games page's categories): which options
// a search leaves, and whether opening it puts the cursor in the search field.

export interface PickOption {
  id: string;
  name: string;
  emoji?: string;
  /** The game's colour; none for a neutral option ("All games"). */
  accent?: string;
}

/** Lowercase, without accents, so "pokemon" finds "Pokémon". */
export const fold = (s: string): string => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** The options whose name holds the search anywhere, ignoring case and accents; all of them for an empty one. */
export function matching<T extends PickOption>(options: readonly T[], query: string): T[] {
  const q = fold(query.trim());
  return q ? options.filter((o) => fold(o.name).includes(q)) : [...options];
}

/**
 * The search field takes focus on opening only from the keyboard or with a fine pointer: on a
 * touch phone it would raise the keyboard over the list before anyone asked to type.
 */
export const searchAtOnce = (fromKeyboard: boolean, coarsePointer: boolean): boolean => fromKeyboard || !coarsePointer;
