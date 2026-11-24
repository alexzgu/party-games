// When a room's picked packs are too small for the game, other packs may lend to it (Bad Hand,
// Doodle Brawl): a whole pack at a time, in pack order, only as many as needed, and only once
// the host says yes. Each game's pack.ts works out what is short and who would lend; this holds
// the shared steps and the question's wording. Pure.

/** The question a host is asked before other packs lend to the room. */
export interface Ask {
  /** What is short, in plain words: "Your packs have 40 answer cards. 6 players need 100." */
  short: string;
  /** What the lending packs add: "cards", "titles". */
  noun: string;
  /** The lending packs' names, in pack order. */
  lenders: string[];
  /** The same key is the same question (same picks, same lenders): a yes holds while it stays. */
  key: string;
}

type Pack = { id: string; name: string; custom?: boolean };

/** The picked packs that exist; when none of them does, the game's default picks (Classic), never every pack. */
export function pickedOr<P extends Pack>(all: readonly P[], ids: readonly string[], defaults: readonly string[]): P[] {
  const some = all.filter((p) => ids.includes(p.id));
  return some.length ? some : all.filter((p) => defaults.includes(p.id));
}

/** Packs in the order they lend: built-ins first, as shipped (Classic first), then the player's own. */
export const lendOrder = <P extends Pack>(packs: readonly P[]): P[] => [...packs.filter((p) => !p.custom), ...packs.filter((p) => p.custom)];

/**
 * The packs from `others` that would lend, in lend order: each one that `helps` while the room is
 * still `short` with those before it, stopping as soon as it no longer is.
 */
export function lenders<P extends Pack>(others: readonly P[], short: (lent: readonly P[]) => boolean, helps: (p: P, lent: readonly P[]) => boolean): P[] {
  const lent: P[] = [];
  for (const p of lendOrder(others)) {
    if (!short(lent)) break;
    if (helps(p, lent)) lent.push(p);
  }
  return lent;
}

/** The question for these picks and lenders, or null when nobody would lend. */
export function ask(picks: readonly Pack[], lent: readonly Pack[], short: string, noun: string): Ask | null {
  if (!lent.length) return null;
  return { short, noun, lenders: lent.map((p) => p.name), key: JSON.stringify([picks.map((p) => p.id), lent.map((p) => p.id)]) };
}

/**
 * Start's check: the room's yes after Start with `yes` (the key of the question the host said yes
 * to, or ''), given the yes it already had (`agreed`). Null while the question has no yes: a yes to
 * another question (other picks or other lenders) does not count.
 */
export function consent(a: Ask | null, agreed: string, yes: string): string | null {
  if (!a) return agreed;
  return yes === a.key || agreed === a.key ? a.key : null;
}

/** "Classic", "Classic and After Dark", "A, B and C". */
export const nameList = (names: readonly string[]): string =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;

/** "Add cards from Classic for this game?" */
export const question = (a: Ask): string => `Add ${a.noun} from ${nameList(a.lenders)} for this game?`;

/** "N things" with the noun's plural when N is not one ("1 title", "no titles"). */
export const count = (n: number, one: string, many: string): string => `${n || 'no'} ${n === 1 ? one : many}`;
