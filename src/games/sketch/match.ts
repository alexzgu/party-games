// Draw & guess: whether a typed guess is the word, or one letter off it.

/** Lower case, accents off, a leading "the", "a" or "an" dropped, then only letters and digits. */
export function normalise(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/^[^a-z0-9]+/, '').replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9]/g, '');
}

export function isMatch(guess: string, word: string): boolean {
  const g = normalise(guess);
  return !!g && g === normalise(word);
}

/** One letter changed, added or dropped. */
function oneOff(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1 || a === b) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

/** One letter off a word of four or more letters: the guesser is told "Close!". */
export function isClose(guess: string, word: string): boolean {
  const w = normalise(word);
  return w.length >= 4 && oneOff(normalise(guess), w);
}
