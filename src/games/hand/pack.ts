// The cards a Bad Hand room deals from, worked out once for the settings page, the lobby, the
// question before Start and Start itself: the picked packs' cards (Classic's when none of the
// picks exists). When the picks alone would stall the game (no prompt to read, or too few answers
// for every hand of ten), other packs would lend the kind that is short, a whole pack at a time
// (src/lib/lend.ts), but only once the host says yes.
import type { HandPack } from '../../lib/content';
import { ask, count, lenders, pickedOr, type Ask } from '../../lib/lend';
import { DEFAULT_SETTINGS, HAND, MAX_PLAYERS } from './state';
import type { Content } from './round';

/** Answer cards a room of `players` needs: a hand of ten each, two seats spare for late joiners, and a refill. */
export const answersNeeded = (players: number): number => (Math.min(players, MAX_PLAYERS - 2) + 2) * HAND + 2 * HAND;

export interface RoomCards {
  /** The packs picked (Classic when none of the picks exists). */
  packs: HandPack[];
  /** The packs that would lend, in pack order; none when the picks suffice. */
  lent: HandPack[];
  /** Answer cards this room needs. */
  need: number;
  /** The question for the host before the lenders' cards join, or null when nothing would be added. */
  ask: Ask | null;
  /** Why the room cannot start even with the lenders, or '' (only when no pack on the phone has any). */
  problem: string;
}

const prompts = (ps: readonly HandPack[]) => ps.reduce((n, p) => n + p.prompts.length, 0);
const answers = (ps: readonly HandPack[]) => ps.reduce((n, p) => n + p.answers.length, 0);

/** The room's cards for `players` players from `all` packs and the picked `ids`. */
export function roomCards(all: readonly HandPack[], ids: readonly string[], players: number): RoomCards {
  const packs = pickedOr(all, ids, DEFAULT_SETTINGS.packs);
  const need = answersNeeded(players);
  const noPrompts = !prompts(packs);
  const short = (lent: readonly HandPack[]) => (noPrompts && !prompts(lent)) || answers([...packs, ...lent]) < need;
  const helps = (p: HandPack, lent: readonly HandPack[]) =>
    (noPrompts && !prompts(lent) && p.prompts.length > 0) || (answers([...packs, ...lent]) < need && p.answers.length > 0);
  const lent = lenders(all.filter((p) => !packs.includes(p)), short, helps);
  const dealt = deal({ packs, lent, need }, true);
  const problem = !dealt.prompts.length ? 'No pack has prompt cards' : !dealt.answers.length ? 'No pack has answer cards' : '';
  return { packs, lent, need, ask: ask(packs, lent, shortfall(packs, need, players), 'cards'), problem };
}

/** "Your packs have no prompt cards." / "Your packs have 40 answer cards. 6 players need 100." */
function shortfall(packs: readonly HandPack[], need: number, players: number): string {
  const p = prompts(packs), a = answers(packs);
  const few = a < need ? `${count(a, 'answer card', 'answer cards')}. ${players} players need ${need}` : '';
  return `Your packs have ${p ? few : `no prompt cards${few ? ` and ${few}` : ''}`}.`;
}

/** The cards dealt: the picks', plus what the lenders lend (the kinds that are short) once the host said yes. */
export function deal(c: Pick<RoomCards, 'packs' | 'lent' | 'need'>, yes: boolean): Content {
  const lent = yes ? c.lent : [];
  const noPrompts = !prompts(c.packs), fewAnswers = answers(c.packs) < c.need;
  return {
    prompts: [...c.packs, ...(noPrompts ? lent : [])].flatMap((p) => p.prompts),
    answers: [...c.packs, ...(fewAnswers ? lent : [])].flatMap((p) => p.answers),
  };
}
