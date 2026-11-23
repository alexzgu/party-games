// The cards a Bad Hand room deals from, worked out once for the settings page, the lobby and the
// host's Start: the picked packs' cards (every pack's when none of the picks exists), with cards
// from the other packs added when the picks alone would stall the game (no prompt to read, or too
// few answers for every hand of ten).
import type { HandPack } from '../../lib/content';
import { HAND, MAX_PLAYERS } from './state';
import type { Content } from './round';

/** Answer cards a room of `players` needs: a hand of ten each, two seats spare for late joiners, and a refill. */
export const answersNeeded = (players: number): number => (Math.min(players, MAX_PLAYERS - 2) + 2) * HAND + 2 * HAND;

export interface RoomCards extends Content {
  /** The packs picked (every pack when none of the picks exists). */
  packs: HandPack[];
  /** The other packs whose cards were added, by name. */
  added: string[];
  /** Why the room cannot start with these cards, or '' (only when no pack on the phone has any). */
  problem: string;
}

/** The room's cards for `players` players from `all` packs and the picked `ids`. */
export function roomCards(all: readonly HandPack[], ids: readonly string[], players: number): RoomCards {
  const some = all.filter((p) => ids.includes(p.id));
  const packs = some.length ? some : [...all];
  const others = all.filter((p) => !packs.includes(p));
  const prompts = packs.flatMap((p) => p.prompts);
  const answers = packs.flatMap((p) => p.answers);
  const added = new Set<string>();
  // No prompt to read: every other pack's prompts.
  if (!prompts.length) for (const p of others) if (p.prompts.length) { prompts.push(...p.prompts); added.add(p.name); }
  // Too few answers: other packs' answers, a whole pack at a time, until there are enough.
  for (const p of others) {
    if (answers.length >= answersNeeded(players)) break;
    if (!p.answers.length) continue;
    answers.push(...p.answers);
    added.add(p.name);
  }
  const problem = !prompts.length ? 'No pack has prompt cards' : !answers.length ? 'No pack has answer cards' : '';
  return { packs, prompts, answers, added: [...added], problem };
}
