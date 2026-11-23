// Sketchy's room: who is in, the clock, and handing each phase to its mode's rules.
import { DELIVERY_MS, MAX_PLAYERS, NAME_MAX, RECONNECT_GRACE_MS, active, left, settling, type Game, type Player } from './core';
import type { ToHost } from './protocol';
import * as T from './telephone';
import * as G from './guess';

export const canStart = (g: Game) => g.phase === 'lobby' && active(g).length >= 3;
export const pause = (g: Game, now: number): Game => g.deadline === null ? g : { ...g, frozen: left(g, now) };
export const resume = (g: Game, now: number): Game => g.frozen === null ? g :
  { ...g, deadline: now + g.frozen, frozen: null, dg: g.dg && { ...g.dg, away: null } };
/** Phones reconnecting to a host that reopened or changed broker get RECONNECT_GRACE_MS before anyone counts as away or missing. */
export const regrace = (g: Game, now: number): Game => ({ ...g, grace: now + RECONNECT_GRACE_MS, dg: g.dg && { ...g.dg, away: null } });
/** A reopened host: a timer that ran out while it was closed gets 12 s, and phones get the reconnect grace. */
export function afterReload(g: Game, now: number): Game {
  const next = regrace(g, now);
  return g.deadline !== null && g.deadline <= now ? { ...next, deadline: now + 12000 } : next;
}

export function join(g: Game, pid: string, name: string, online: ReadonlySet<string>) {
  name = name.trim().slice(0, NAME_MAX);
  if (!pid || Object.hasOwn(Object.prototype, pid) || !name) return { error: 'Enter a player name to join.' };
  const gone = g.left ?? [];
  if (gone.includes(pid)) {
    if (active(g).length >= MAX_PLAYERS) return { error: 'This room is full.' };
    // Back in a new game's lobby (Play again leaves out who had left): a player again.
    const seat: Player[] = g.players.some((p) => p.pid === pid) ? [] : [{ pid, name, score: 0 }];
    return { pid, game: { ...g, players: [...g.players, ...seat], kicked: g.kicked.filter((x) => x !== pid), left: gone.filter((x) => x !== pid) } };
  }
  if (g.kicked.includes(pid)) return { error: 'The host removed you from this room.' };
  if (g.players.some((p) => p.pid === pid)) return { pid, game: g };
  const match = active(g).find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (match) return online.has(match.pid) ? { error: 'That name is already in use.' } : { pid: match.pid, game: g };
  if (active(g).length >= MAX_PLAYERS) return { error: 'This room is full.' };
  return { pid, game: { ...g, players: [...g.players, { pid, name, score: 0 }] } };
}

export function kick(g: Game, pid: string): Game {
  return { ...g, kicked: [...g.kicked, pid], left: (g.left ?? []).filter((x) => x !== pid),
    players: g.phase === 'lobby' ? g.players.filter((p) => p.pid !== pid) : g.players };
}

/** "Leave room": in the lobby they are simply gone; mid-game out like a removed player, but free to come back. */
export function leave(g: Game, pid: string): Game {
  if (!active(g).some((p) => p.pid === pid)) return g;
  if (g.phase === 'lobby') return { ...g, players: g.players.filter((p) => p.pid !== pid) };
  return { ...g, kicked: [...g.kicked, pid], left: [...(g.left ?? []), pid] };
}

/** The host's skip (End step, End turn, Next). */
export function skip(g: Game, now: number, online: ReadonlySet<string>): Game {
  if (T.inStep(g)) return T.endStep(g, now);
  return g.dg ? G.skip(g, now, online) : g;
}

/** The clock, four times a second: timers, everyone done, a missing drawer, hints. */
export function tick(g: Game, now: number, online: ReadonlySet<string>): Game {
  if (g.frozen !== null || g.deadline === null) return g;
  if (!T.inStep(g)) return g.dg ? G.tickGuess(g, now, online) : g;
  // A phone sends what it has at zero: leave a second for it to arrive.
  const done = !settling(g, now) && T.stepDone(g, online);
  return g.deadline + DELIVERY_MS <= now || done ? T.endStep(g, now) : g;
}

/** A phone's line, drawing, word pick or guess, applied to the game as it is now (the message's
 * own `at` turns away one meant for an earlier phase). Lines and drawings wait out a pause. */
export function act(g: Game, pid: string, m: Exclude<ToHost, { t: 'art?' } | { t: 'ink' }>, now: number): Game {
  if (m.t === 'guess') return G.guess(g, pid, m.at, m.text, now);
  if (m.t === 'pick') return G.pick(g, pid, m.at, m.i, now);
  if (g.frozen !== null) return g;
  return m.t === 'line' ? T.submitLine(g, pid, m.at, m.text) : T.submitDrawing(g, pid, m.at, !m.d.length);
}
