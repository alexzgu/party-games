// What a Sketchy room deals from, worked out once for the settings page, the lobby, the question
// before Start and Start itself: the picked packs' words (Draw & guess) or ideas (Telephone),
// Classic's when none of the picks exists. When they are too few for a whole game in this room,
// other packs would lend, a whole pack at a time (src/lib/lend.ts), but only once the host says
// yes. Pure.
import type { SketchPack } from '../../lib/content';
import { ask, count, lenders, pickedOr, type Ask } from '../../lib/lend';
import { DEFAULT_SETTINGS, MAX_PLAYERS, type Settings } from './core';

/** Words a drawer is offered each turn. */
export const OFFER = 3;

/**
 * What a whole game of `players` needs, none twice. Draw & guess: three words offered per turn,
 * a turn per player each round, rounds after the first sized for two late joiners (they join at
 * the next round), up to a full room. Telephone: an idea per chain, enough for every opening line
 * left blank (nobody joins once the chains start).
 */
export const needed = (players: number, s: Pick<Settings, 'mode' | 'rounds'>): number =>
  s.mode === 'telephone' ? players : OFFER * (players + (s.rounds - 1) * Math.min(players + 2, MAX_PLAYERS));

export interface RoomItems {
  /** 'words' (Draw & guess) or 'ideas' (Telephone). */
  kind: 'words' | 'ideas';
  /** The packs picked (Classic when none of the picks exists). */
  packs: SketchPack[];
  /** The packs that would lend, in pack order; none when the picks suffice. */
  lent: SketchPack[];
  /** The question for the host before the lenders' items join, or null when nothing would be added. */
  ask: Ask | null;
  /** Why the room cannot start even with the lenders, or ''. */
  problem: string;
}

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** The packs' items of `kind`, none twice (ignoring case, spacing and punctuation), in order. */
function unique(packs: readonly SketchPack[], kind: RoomItems['kind']): string[] {
  const seen = new Set<string>();
  return packs.flatMap((p) => p[kind]).filter((x) => !seen.has(key(x)) && !!seen.add(key(x)));
}

/** The room's words or ideas (whichever its mode deals) for `players` players from `all` packs. */
export function roomItems(all: readonly SketchPack[], s: Pick<Settings, 'mode' | 'rounds' | 'packs'>, players: number): RoomItems {
  const kind = s.mode === 'telephone' ? 'ideas' : 'words';
  const packs = pickedOr(all, s.packs, DEFAULT_SETTINGS.packs);
  const need = needed(players, s);
  const have = (lent: readonly SketchPack[]) => unique([...packs, ...lent], kind).length;
  const helps = (p: SketchPack, lent: readonly SketchPack[]) => have([...lent, p]) > have(lent);
  const lent = lenders(all.filter((p) => !packs.includes(p)), (l) => have(l) < need, helps);
  const n = unique(packs, kind).length;
  return {
    kind, packs, lent, problem: have(lent) ? '' : `No pack has ${kind}`,
    ask: ask(packs, lent, `Your packs have ${count(n, kind.slice(0, -1), kind)}. ${players} players need ${need}.`, kind),
  };
}

/** The items in the order the game deals them: the picks' shuffled, then (once the host said yes) the lenders' shuffled, none twice. */
export function dealItems(c: Pick<RoomItems, 'kind' | 'packs' | 'lent'>, yes: boolean, shuffle: <T>(xs: readonly T[]) => T[]): string[] {
  const seen = new Set<string>();
  return [...shuffle(unique(c.packs, c.kind)), ...shuffle(unique(yes ? c.lent : [], c.kind))]
    .filter((x) => !seen.has(key(x)) && !!seen.add(key(x)));
}
