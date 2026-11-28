// The clock and the event log of a turn-by-turn table game on the host (Go Fish, Big 2): a phase
// with an optional deadline, pause and resume, the quiet moment after a reload while phones find
// the room again, and the last few events numbered from 1.

/** After the host screen opens or changes broker, how long phones get to reconnect before anyone counts as gone (*house*). */
export const RECONNECT_MS = 10_000;
/** A timer that ran out while the host screen was closed gets this long after it reopens. */
const RELOAD_GRACE_MS = 12_000;

export type Clocked = {
  phase: string; at: number; deadline: number | null;
  /** When the host paused (null: running), and the timer's ms left then (null: no timer). */
  paused: number | null; frozen: number | null;
  /** Until then phones are still reconnecting (host reload, broker change): nobody counts as gone. */
  quiet: number | null;
};
/** No clock runs in these phases. */
const idle = (g: Clocked) => g.phase === 'lobby' || g.phase === 'over';

export const left = (g: Clocked, now: number) => g.paused !== null ? g.frozen : g.deadline === null ? null : Math.max(0, g.deadline - now);
export const reconnecting = (g: Clocked, now: number) => g.quiet !== null && now < g.quiet;

/** A new phase (a new `at`, so late messages for the old one count for nothing), timed when `ms` is given. */
export function enter<G extends Clocked>(g: G, phase: G['phase'], now: number, ms?: number): G {
  return { ...g, phase, at: g.at + 1, deadline: ms === undefined ? null : now + ms, paused: null, frozen: null };
}

/** Stops the clock in any phase of play. */
export const pause = <G extends Clocked>(g: G, now: number): G =>
  g.paused !== null || idle(g) ? g : { ...g, paused: now, frozen: left(g, now) };

export const resume = <G extends Clocked>(g: G, now: number): G =>
  g.paused === null ? g : { ...g, paused: null, frozen: null, deadline: g.frozen !== null ? now + g.frozen : g.deadline };

/** Phones get a moment to find the room again before anyone counts as gone. */
export const quiet = <G extends Clocked>(g: G, now: number): G => ({ ...g, quiet: now + RECONNECT_MS });

/** After the host screen reloads: a timer that ran out meanwhile gets 12 s, and phones get time to reconnect. */
export const afterReload = <G extends Clocked>(g: G, now: number): G =>
  quiet({ ...g, deadline: g.deadline !== null && g.deadline <= now ? now + RELOAD_GRACE_MS : g.deadline }, now);

/** The last `size` events, oldest first, and how many the game has had. */
export type Logged<E> = { log: (E & { n: number })[]; count: number };

/** Adds events to the log, numbered, keeping the last `size`. */
export function note<E extends object, G extends Logged<E>>(g: G, events: readonly E[], size: number): { game: G; added: (E & { n: number })[] } {
  const added = events.map((e, i) => ({ ...e, n: g.count + i + 1 }));
  return { game: { ...g, log: [...g.log, ...added].slice(-size), count: g.count + added.length }, added };
}
