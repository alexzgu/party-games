// What a Snark Tank room deals from, worked out once for the settings page, the lobby, the
// question before Start and Start itself: the picked packs' prompts and finals (Classic's when
// none of the picks exists). When the picks are too few for a whole game in this room, other
// packs would lend the kind that is short, a whole pack at a time (src/lib/lend.ts), but only
// once the host says yes. Pure.
import { dedupe, type SnarkFinal, type SnarkPack } from '../../lib/content';
import { ask, count, lenders, pickedOr, type Ask } from '../../lib/lend';
import { DEFAULT_SETTINGS, MAX_PLAYERS, type Settings } from './logic';

/** The packs that lend to a game, by the kind they lend (pack ids). */
export interface Lent { prompts: string[]; finals: string[] }

/** Prompts and finals a whole game needs. */
export interface Needs { prompts: number; finals: number }

/**
 * What a game of `players` needs, none twice: a prompt per player in each head-to-head round
 * (round 1 as the room starts, round 2 sized for two late joiners, up to a full room), and for
 * the final one prompt for everyone or, with three-line duels, a final per pair (an odd one out
 * faces the house with one of its own), sized likewise. `duels` is false when no pack on the
 * phone has a final, so the final is one prompt for everyone.
 */
export function needs(players: number, s: Pick<Settings, 'rounds' | 'final'>, duels: boolean): Needs {
  const later = Math.min(players + 2, MAX_PLAYERS);
  return { prompts: players + (s.rounds === 3 ? later : 0) + (duels ? 0 : 1), finals: duels ? Math.ceil(later / 2) : 0 };
}

export interface RoomPrompts {
  /** The packs picked (Classic when none of the picks exists). */
  packs: SnarkPack[];
  /** The packs that would lend, in pack order; none when the picks suffice. */
  lent: SnarkPack[];
  need: Needs;
  /** The question for the host before the lenders' prompts join, or null when nothing would be added. */
  ask: Ask | null;
  /** Why the room cannot start even with the lenders, or ''. */
  problem: string;
}

const finalsOf = (p: SnarkPack): SnarkFinal[] => (p.finals ?? []).filter((f) => f.house?.some((l) => l.trim()));
/** The packs' prompts, none twice (ignoring case and spacing). */
export const promptsOf = (ps: readonly SnarkPack[]): string[] => dedupe(ps.flatMap((p) => p.prompts));
/** The packs' finals, none twice. */
export function finalsIn(ps: readonly SnarkPack[]): SnarkFinal[] {
  const seen = new Set<string>();
  return ps.flatMap(finalsOf).filter((f) => !seen.has(f.prompt) && !!seen.add(f.prompt));
}

/** The room's prompts and finals for `players` players from `all` packs and the room's settings. */
export function roomPrompts(all: readonly SnarkPack[], s: Pick<Settings, 'packIds' | 'rounds' | 'final'>, players: number): RoomPrompts {
  const packs = pickedOr(all, s.packIds, DEFAULT_SETTINGS.packIds);
  const need = needs(players, s, s.final === 'duels' && all.some((p) => finalsOf(p).length > 0));
  const fewPrompts = (lent: readonly SnarkPack[]) => promptsOf([...packs, ...lent]).length < need.prompts;
  const fewFinals = (lent: readonly SnarkPack[]) => finalsIn([...packs, ...lent]).length < need.finals;
  const helps = (p: SnarkPack, lent: readonly SnarkPack[]) =>
    (fewPrompts(lent) && promptsOf([...packs, ...lent, p]).length > promptsOf([...packs, ...lent]).length) ||
    (fewFinals(lent) && finalsIn([...packs, ...lent, p]).length > finalsIn([...packs, ...lent]).length);
  const lent = lenders(all.filter((p) => !packs.includes(p)), (l) => fewPrompts(l) || fewFinals(l), helps);
  const problem = promptsOf([...packs, ...lent]).length ? '' : 'No pack has prompts';
  const kinds = [...(fewPrompts([]) ? ['prompts'] : []), ...(fewFinals([]) ? ['finals'] : [])];
  return { packs, lent, need, ask: ask(packs, lent, shortfall(packs, need, players), kinds.join(' and '), kinds), problem };
}

/** "Your packs have 6 prompts. 5 players need 13." / "Your packs have no finals." / both. */
function shortfall(packs: readonly SnarkPack[], need: Needs, players: number): string {
  const p = promptsOf(packs).length, f = finalsIn(packs).length;
  const prompts = p < need.prompts ? count(p, 'prompt', 'prompts') : '', finals = f < need.finals ? count(f, 'final', 'finals') : '';
  if (prompts && finals) return `Your packs have ${prompts} and ${finals}. ${players} players need ${need.prompts} prompts and ${need.finals} finals.`;
  if (finals && !f) return 'Your packs have no finals.';
  return `Your packs have ${prompts || finals}. ${players} players need ${prompts ? need.prompts : need.finals}.`;
}

/** The packs that lend each kind once the host said yes: only the kind the picks are short of. */
export function lending(c: Pick<RoomPrompts, 'packs' | 'lent' | 'need'>, yes: boolean): Lent {
  const ids = yes ? c.lent.map((p) => p.id) : [];
  return {
    prompts: promptsOf(c.packs).length < c.need.prompts ? ids : [],
    finals: finalsIn(c.packs).length < c.need.finals ? ids : [],
  };
}

/**
 * What a game deals from: the picks (Classic when none exists), and for each kind the picks
 * followed by the packs lent that kind.
 */
export function pools(all: readonly SnarkPack[], ids: readonly string[], lent: Lent | undefined): { picks: SnarkPack[]; prompts: SnarkPack[]; finals: SnarkPack[] } {
  const picks = pickedOr(all, ids, DEFAULT_SETTINGS.packIds);
  const plus = (more: readonly string[] = []) => [...picks, ...all.filter((p) => more.includes(p.id) && !picks.includes(p))];
  return { picks, prompts: plus(lent?.prompts), finals: plus(lent?.finals) };
}

/** What a game deals from (`pools`). */
export type Pools = ReturnType<typeof pools>;

/** Deals one item at a time, so nothing comes back across games until its pool runs out (lib/bag). */
export type Bag<T> = { next(): T | undefined };

/**
 * `count` items from `pools` in order (the picks', then the lenders'): each from the first pool
 * that still has one this game has not dealt (`used`, by `id`), drawn through that pool's `bag`;
 * once every pool is used up, the first pool's come round again. `used` gains what is dealt.
 */
export function dealIn<T>(pools: readonly (readonly T[])[], count: number, id: (t: T) => string, used: Set<string>, bag: (i: number) => Bag<T>): T[] {
  const live = pools.map((items, i) => ({ items, bag: items.length ? bag(i) : null })).filter((p) => p.bag);
  const out: T[] = [];
  for (let n = 0; n < count && live.length; n++) {
    const from = live.find((p) => p.items.some((t) => !used.has(id(t)))) ?? live[0];
    let t = from.bag!.next();
    for (let tries = 0; t !== undefined && used.has(id(t)) && tries < 2 * from.items.length; tries++) t = from.bag!.next();
    if (t === undefined) break;
    used.add(id(t));
    out.push(t);
  }
  return out;
}

/** The names History shows: the picks', then the lenders'. */
export function poolNames(all: readonly SnarkPack[], ids: readonly string[], lent: Lent | undefined): string[] {
  const { prompts, finals } = pools(all, ids, lent);
  return [...new Set([...prompts, ...finals].map((p) => p.name))];
}

