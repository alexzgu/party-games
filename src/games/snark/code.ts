// Room codes: four consonants, none that read as another letter or a digit (no vowels, so no
// words either; no L, which reads as I or 1). The host's peer id on the broker is built from it.
export const CODE_LETTERS = 'BCDFGHJKMNPQRSTVWXZ';
export const CODE_LENGTH = 4;

export function newCode(rand: () => number = Math.random): string {
  return Array.from({ length: CODE_LENGTH }, () => CODE_LETTERS[Math.floor(rand() * CODE_LETTERS.length)]).join('');
}

/** What a player typed, cleaned: upper case, only code letters, at most four. */
export const cleanCode = (raw: string) => [...raw.toUpperCase()].filter((c) => CODE_LETTERS.includes(c)).join('').slice(0, CODE_LENGTH);

export const isCode = (s: string) => s.length === CODE_LENGTH && cleanCode(s) === s;

export const hostPeerId = (code: string) => `jerkbox-snark-${code}`;

/** A random id for this phone, kept in localStorage so a reload rejoins as the same player. */
export const newPid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
