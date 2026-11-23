// Built-in words and ideas dealt after the room's packs run out (or when there are none), so a
// game never repeats one until these are used up too.
export const SPARE_WORDS = [
  'Cat', 'House', 'Tree', 'Sun', 'Car', 'Fish', 'Boat', 'Apple', 'Clock', 'Chair', 'Hat', 'Shoe', 'Moon', 'Star',
  'Cloud', 'Flower', 'Bird', 'Dog', 'Key', 'Cup', 'Book', 'Guitar', 'Pizza', 'Snowman', 'Rocket', 'Ladder', 'Kite',
  'Umbrella', 'Bicycle', 'Bridge', 'Candle', 'Spoon', 'Glasses', 'Banana', 'Train', 'Castle', 'Rainbow', 'Snail',
  'Whale', 'Crown',
];
export const SPARE_IDEAS = [
  'A cat that runs a bakery', 'Dancing in the rain', 'The worst first date ever', 'A dragon at the dentist',
  'Grandma wins the lottery', 'A snowman on a beach holiday', 'The last slice of pizza', 'A robot learning to swim',
  'Lost keys at a wedding', 'A ghost doing laundry', 'A dog driving a bus', 'The world’s tallest sandwich',
];

/** The packs' items shuffled, then the spares shuffled, without repeats (ignoring case and spacing). */
export function deal(items: string[], spares: string[], shuffle: <T>(xs: readonly T[]) => T[]): string[] {
  const seen = new Set<string>();
  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return [...shuffle(items), ...shuffle(spares)].filter((x) => !seen.has(key(x)) && !!seen.add(key(x)));
}
