// Draw & guess hints: the word's shape, with a letter shown at half time and another at three quarters.
import { shuffle } from '../../lib/random';

const letter = (ch: string) => /\p{L}|\d/u.test(ch);

/** Where the hints go: up to two letter places, never more than a third of the letters. */
export function hintPlaces(word: string, rand: () => number = Math.random): number[] {
  const places = [...word].flatMap((ch, i) => letter(ch) ? [i] : []);
  return shuffle(places, rand).slice(0, Math.min(2, Math.floor(places.length / 3)));
}

/** How many hints are due with `left` of `total` ms to go. */
export function hintsDue(left: number, total: number): number {
  const gone = total > 0 ? 1 - left / total : 0;
  return gone >= 0.75 ? 2 : gone >= 0.5 ? 1 : 0;
}

/** The word as guessers see it: `_` for each hidden letter; spaces, hyphens and apostrophes shown. */
export function shape(word: string, shown: number[]): string {
  return [...word].map((ch, i) => letter(ch) && !shown.includes(i) ? '_' : ch).join('');
}
