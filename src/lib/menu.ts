// A small menu that opens from a button (components/MenuButton.svelte): where the arrow keys,
// Home and End move to, and which way the menu opens.

/** The item a key moves to from item `at` (-1: none yet) of `count`; null for any other key. Arrows wrap. */
export function menuMove(key: string, at: number, count: number): number | null {
  if (!count) return null;
  if (key === 'ArrowDown') return at < 0 ? 0 : (at + 1) % count;
  if (key === 'ArrowUp') return at < 0 ? count - 1 : (at - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return null;
}

/** Up (the usual way, from a button low on the screen) when the menu fits above it or there is more room there than below. */
export const opensUp = (above: number, below: number, height: number): boolean => above >= height || above >= below;
