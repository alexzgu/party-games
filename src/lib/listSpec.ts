// The rules one list of a list pack keeps (Doodle Brawl, Bad Hand, Sketchy): described once per
// game in its rules.ts and read by every route an item can take, the wizard server's included, so
// this file stays pure.

/** One list of a pack: its field, names, and the rules an item must meet. */
export interface ListSpec {
  field: string;
  /** What one item is called, and many ("prompt", "prompts"). */
  one: string;
  many: string;
  /** A typed or pasted item as stored: spaces collapsed, and the game's own tidying. */
  tidy: (s: string) => string;
  /** Why a tidied item cannot be used, or '' when it can. */
  problem: (s: string) => string;
  /** How two items are told apart: equal keys are the same item. */
  key: (s: string) => string;
  /** Characters the editor's box takes. */
  max: number;
  /** An example for the editor's empty box. */
  example: string;
  /** What the editor says under the box (the format), when it needs saying. */
  hint?: string;
}

/** `s` without any of `chars` at its end (a loop: a regex here takes quadratic time on hostile text). */
export function stripEnd(s: string, chars: string): string {
  let n = s.length;
  while (n > 0 && chars.includes(s[n - 1])) n--;
  return s.slice(0, n);
}

/** `x` as an item of `spec`'s list: tidied, or null when it breaks a rule. */
export function checked(spec: ListSpec, x: unknown): string | null {
  if (typeof x !== 'string') return null;
  const t = spec.tidy(x.trim().replace(/\s+/g, ' '));
  return t && !spec.problem(t) ? t : null;
}
