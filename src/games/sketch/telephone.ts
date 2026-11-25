// Telephone (Gartic Phone's normal mode): write, then draw what you were handed, then describe
// the drawing you were handed, and so on, one chain per player; then the album.
import { enter, isActive, nextItems, type Entry, type Game, type Telephone } from './core';

export type StepKind = 'write' | 'draw' | 'describe';
export const stepKind = (step: number): StepKind => step === 0 ? 'write' : step % 2 ? 'draw' : 'describe';
const seconds = (g: Game, step: number) => stepKind(step) === 'draw' ? g.settings.drawSecs : g.settings.writeSecs;

/** Starts the chains: `order` plays, in that seat order; `square` from latinSquare(order.length). */
export function startTelephone(g: Game, order: string[], square: number[][], ideas: string[], now: number): Game {
  const tel: Telephone = { order, square, step: 0, chains: order.map(() => order.map(() => null)), ideas, page: { chain: 0, entry: 0 } };
  return enter({ ...g, tel, dg: undefined }, 'write', now, seconds(g, 0));
}

export const inStep = (g: Game) => !!g.tel && (g.phase === 'write' || g.phase === 'draw' || g.phase === 'describe');

/** What a player does this step: the chain, the entry handed to them (null at step 1) and whether it is done. */
export function task(g: Game, pid: string) {
  const t = g.tel;
  if (!t || !inStep(g)) return null;
  const seat = t.order.indexOf(pid);
  if (seat < 0) return null;
  const chain = t.square[t.step][seat];
  return {
    chain, step: t.step, kind: stepKind(t.step), id: `${g.id}/${t.step}/${chain}`,
    handed: t.step ? t.chains[chain][t.step - 1] : null, done: !!t.chains[chain][t.step],
  };
}

/** An empty line's stand-in when the room has no idea at all. */
export const NO_IDEA = 'Anything at all';

/** How many of the room's ideas Suggest offers a seat on a write step. */
export const SUGGESTIONS = 5;

/**
 * Ideas Suggest offers seat `seat` on a write step, tap by tap: the room's own, those not yet used
 * from the end (blank lines are filled from the front, the picks' first), then those used. Each
 * seat starts its own share further on, so while the room has at least as many ideas as seats, no
 * two seats are offered the same idea on the same tap.
 */
export function suggestions(t: Telephone, seat: number): string[] {
  const room = [...[...t.ideas].reverse(), ...(t.dealt ?? [])];
  const n = Math.min(SUGGESTIONS, room.length), share = Math.max(1, Math.floor(room.length / t.order.length));
  return Array.from({ length: n }, (_, i) => room[(seat * share + i) % room.length]);
}

type Ideas = Pick<Telephone, 'ideas' | 'dealt'>;

/** The room's ideas once `text` is used: out of those not yet used, last among those used. */
const used = (t: Ideas, text: string): Ideas => ({ ideas: t.ideas.filter((x) => x !== text), dealt: [...(t.dealt ?? []).filter((x) => x !== text), text] });

/**
 * The room's next idea, marked as written by the game: one not yet used, and on the write step
 * one no seat is offered by Suggest where there is one; else (more blanks than the room counted
 * on) the room's own ideas come round again, least recently used first.
 */
function idea(t: Telephone, by: string): [Entry, Ideas] {
  const offered = new Set(t.step ? [] : t.order.flatMap((_, seat) => suggestions(t, seat)));
  const free = t.ideas.find((x) => !offered.has(x));
  if (free) return [{ kind: 'text', text: free, by, filled: true }, used(t, free)];
  const { items: [text = NO_IDEA], pool: ideas, dealt } = nextItems(t.ideas, t.dealt ?? [], 1);
  return [{ kind: 'text', text, by, filled: true }, { ideas, dealt }];
}

function put(g: Game, chain: number, entry: Entry, ideas: Ideas = g.tel!): Game {
  const t = g.tel!;
  const chains = t.chains.map((c, i) => i === chain ? c.map((e, s) => s === t.step ? entry : e) : c);
  return { ...g, tel: { ...t, chains, ideas: ideas.ideas, dealt: ideas.dealt } };
}

/** A line for a write or describe step; an empty one becomes a random idea. */
export function submitLine(g: Game, pid: string, at: number, text: string): Game {
  const t = task(g, pid);
  if (at !== g.at || !t || t.done || t.kind === 'draw' || !isActive(g, pid)) return g;
  const line = text.trim().replace(/\s+/g, ' ');
  // A line that is one of the room's ideas (Suggest) counts as used: no blank is filled with it while another is left.
  if (line) return put(g, t.chain, { kind: 'text', text: line, by: pid }, g.tel!.ideas.includes(line) ? used(g.tel!, line) : g.tel!);
  const [entry, ideas] = idea(g.tel!, pid);
  return put(g, t.chain, entry, ideas);
}

/** A drawing for a draw step; `id` null when it was left blank. The host stores the strokes under task().id. */
export function submitDrawing(g: Game, pid: string, at: number, blank: boolean): Game {
  const t = task(g, pid);
  if (at !== g.at || !t || t.done || t.kind !== 'draw' || !isActive(g, pid)) return g;
  return put(g, t.chain, { kind: 'drawing', id: blank ? null : t.id, by: pid });
}

/** Every player still in and online has done this step. */
export function stepDone(g: Game, online: ReadonlySet<string>): boolean {
  const here = g.tel!.order.filter((pid) => isActive(g, pid) && online.has(pid));
  return here.length > 0 && here.every((pid) => task(g, pid)!.done);
}

/** Fills the step's gaps (a line becomes an idea, a drawing is blank), then the next step or the album. */
export function endStep(g: Game, now: number): Game {
  let next = g;
  for (const pid of g.tel!.order) {
    const t = task(next, pid)!;
    if (t.done) continue;
    if (t.kind === 'draw') next = put(next, t.chain, { kind: 'drawing', id: null, by: pid });
    else {
      const [entry, ideas] = idea(next.tel!, pid);
      next = put(next, t.chain, entry, ideas);
    }
  }
  const tel = next.tel!;
  const step = tel.step + 1;
  if (step >= tel.order.length) return enter({ ...next, tel: { ...tel, page: { chain: 0, entry: 0 } } }, 'album', now);
  return enter({ ...next, tel: { ...tel, step } }, stepKind(step), now, seconds(next, step));
}

/** The album's next (1) or previous (-1) entry, chain by chain; it stops at either end. */
export function turnPage(g: Game, dir: 1 | -1): Game {
  const t = g.tel;
  if (g.phase !== 'album' || !t) return g;
  const n = t.order.length;
  const flat = t.page.chain * n + t.page.entry + dir;
  if (flat < 0 || flat >= n * n) return g;
  return { ...g, at: g.at + 1, tel: { ...t, page: { chain: Math.floor(flat / n), entry: flat % n } } };
}

export const albumEnd = (t: Telephone) => t.page.chain === t.order.length - 1 && t.page.entry === t.order.length - 1;

/** For History: each chain's first line and its last line. */
export function chainLines(t: Telephone): string[] {
  return t.chains.map((c) => {
    const lines = c.flatMap((e) => e?.kind === 'text' ? [e.text] : []);
    return lines.length > 1 ? `${lines[0]} → ${lines.at(-1)}` : lines[0] ?? '';
  });
}
