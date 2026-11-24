// Doodle Brawl's titles for one game, worked out once for the settings page, the lobby, the
// question before Start and Start itself: the picked packs' titles (Classic's when none of the
// picks exists). When they are too few for a whole game in this room, other packs would lend,
// a whole pack at a time (src/lib/lend.ts), but only once the host says yes.
import type { BrawlPack } from '../../lib/content';
import { ask, count, lenders, pickedOr, type Ask } from '../../lib/lend';
import { DEFAULT_SETTINGS, MAX_PLAYERS } from './logic';
import { titleKey } from './rules';

/**
 * Titles a whole game for `players` needs, none twice: one per bout in round 1 (a bout per
 * player), and a title and a rematch title per bout in round 2, sized for two late joiners as
 * well (they draw from round 2), up to a full room.
 */
export const titlesNeeded = (players: number): number => players + 2 * Math.min(players + 2, MAX_PLAYERS);

export interface RoomTitles {
  /** The packs picked (Classic when none of the picks exists). */
  packs: BrawlPack[];
  /** The packs that would lend, in pack order; none when the picks suffice. */
  lent: BrawlPack[];
  /** The question for the host before the lenders' titles join, or null when nothing would be added. */
  ask: Ask | null;
  /** Why the room cannot start even with the lenders, or ''. */
  problem: string;
}

/** The titles of `packs`, none twice (ignoring case, spacing and punctuation), in order. */
function unique(packs: readonly BrawlPack[]): string[] {
  const seen = new Set<string>();
  return packs.flatMap((p) => p.titles).filter((t) => !seen.has(titleKey(t)) && !!seen.add(titleKey(t)));
}

/** The room's titles for `players` players from `all` packs and the picked `ids`. */
export function roomTitles(all: readonly BrawlPack[], ids: readonly string[], players: number): RoomTitles {
  const packs = pickedOr(all, ids, DEFAULT_SETTINGS.packs);
  const need = titlesNeeded(players);
  const short = (lent: readonly BrawlPack[]) => unique([...packs, ...lent]).length < need;
  const helps = (p: BrawlPack, lent: readonly BrawlPack[]) => unique([...packs, ...lent, p]).length > unique([...packs, ...lent]).length;
  const lent = lenders(all.filter((p) => !packs.includes(p)), short, helps);
  const have = unique(packs).length;
  return {
    packs, lent, problem: unique([...packs, ...lent]).length ? '' : 'No pack has titles',
    ask: ask(packs, lent, `Your packs have ${count(have, 'title', 'titles')}. ${players} players need ${need}.`, 'titles'),
  };
}

/** The titles in the order the game deals them: the picks' shuffled, then (once the host said yes) the lenders' shuffled, none twice. */
export function dealTitles(c: Pick<RoomTitles, 'packs' | 'lent'>, yes: boolean, shuffle: <T>(xs: T[]) => T[]): string[] {
  const seen = new Set<string>();
  return [...shuffle(unique(c.packs)), ...shuffle(unique(yes ? c.lent : []))]
    .filter((t) => !seen.has(titleKey(t)) && !!seen.add(titleKey(t)));
}
