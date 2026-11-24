// Go Fish's game state on the host, and the small reads every other module shares.
import { RANKS, rankOf, type Card, type Rank } from '../../lib/cards/deck';

export const NAME_MAX = 20;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
/** Seconds per turn; 0 is no limit (the host's advance asks for the player). */
export const TURN_TIMES = [20, 30, 45, 0] as const;
/** How long an outcome stays up before the next turn. */
export const SHOW_MS = 3_000;
/** After the host screen opens or changes broker, how long phones get to reconnect before anyone counts as gone (*house*). */
export const RECONNECT_MS = 10_000;
/** Events the views carry: the outcome in play and the last few before it. */
export const LOG_SIZE = 8;

export type Settings = { seconds: number };
export const DEFAULT_SETTINGS: Settings = { seconds: 30 };

/** `turn`: waiting for a player's ask; `show`: its outcome is up. */
export type Phase = 'lobby' | 'turn' | 'show' | 'over';
export type Player = { pid: string; name: string };
/**
 * What happened, in the order it happened; `n` counts the game's events from 1, so a bot can tell
 * which it has seen. `asked`: `got` cards of `rank` moved from `from` to `by` (0: "Go fish!").
 * `drew`: `by` drew from the pool, after a go fish (`fish`), with an empty hand (`empty`), or
 * with nobody to ask (`nobody`); `rank` only when it was the rank asked for, shown to the room.
 * `dry`: a go fish with the pool empty. `book`: `by` laid down the four of `rank`. `skip`: `by`
 * had no cards and the pool was empty. `gone`: `by` left or was removed, their hand back in the pool.
 */
export type NewEvent =
  | { k: 'asked'; by: string; from: string; rank: Rank; got: number }
  | { k: 'drew'; by: string; why: 'fish' | 'empty' | 'nobody'; rank?: Rank }
  | { k: 'dry'; by: string }
  | { k: 'book'; by: string; rank: Rank }
  | { k: 'skip'; by: string }
  | { k: 'gone'; by: string };
export type Event = NewEvent & { n: number };

export type Game = {
  id: string; code: string; settings: Settings; phase: Phase; at: number;
  deadline: number | null;
  /** When the host paused (null: running), and the timer's ms left then (null: no timer). */
  paused: number | null; frozen: number | null;
  /** Until then phones are still reconnecting (host reload, broker change): nobody counts as gone. */
  quiet: number | null;
  players: Player[]; kicked: string[];
  /** Players out by their own choice ("Leave room"), among `kicked` until they come back. */
  left: string[];
  /** The players dealt in, in seat order (the turn goes round them); late joiners wait for the next deal. */
  seats: string[];
  hands: Record<string, Card[]>;
  /** Face down; the first card is the top. */
  pool: Card[];
  books: Record<string, Rank[]>;
  /** Whose turn it is (`turn`), or who asked (`show`). */
  turn: string | null;
  /** In `show`: who plays next. */
  next: string | null;
  /** In `show`: the events of the ask in play. */
  shown: Event[];
  /** The last events, oldest first (at most `LOG_SIZE`), and how many the game has had. */
  log: Event[]; count: number;
  /** In `show`: the card the asker drew, for their phone alone. */
  drew: Card | null;
};

export const newGame = (id: string, code: string, settings: Settings): Game => ({
  id, code, settings, phase: 'lobby', at: 0, deadline: null, paused: null, frozen: null, quiet: null,
  players: [], kicked: [], left: [], seats: [], hands: {}, pool: [], books: {},
  turn: null, next: null, shown: [], log: [], count: 0, drew: null,
});

export const active = (g: Game) => g.players.filter((p) => !g.kicked.includes(p.pid));
export const isActive = (g: Game, pid: string) => g.players.some((p) => p.pid === pid) && !g.kicked.includes(pid);
/** Dealt in and still in the game. */
export const playing = (g: Game, pid: string) => g.seats.includes(pid) && isActive(g, pid);
export const hand = (g: Game, pid: string): Card[] => g.hands[pid] ?? [];
export const holds = (g: Game, pid: string, rank: Rank) => hand(g, pid).some((c) => rankOf(c) === rank);
export const booksDown = (g: Game) => Object.values(g.books).reduce((n, b) => n + b.length, 0);
export const allDown = (g: Game) => booksDown(g) === RANKS;
/** Players still in the game who were dealt in, most books first (ties keep seat order). */
export const standings = (g: Game) => g.seats.filter((pid) => isActive(g, pid))
  .map((pid) => g.players.find((p) => p.pid === pid)!)
  .sort((a, b) => (g.books[b.pid]?.length ?? 0) - (g.books[a.pid]?.length ?? 0));
export const left = (g: Game, now: number) => g.paused !== null ? g.frozen : g.deadline === null ? null : Math.max(0, g.deadline - now);
export const reconnecting = (g: Game, now: number) => g.quiet !== null && now < g.quiet;
export const canStart = (g: Game) => g.phase === 'lobby' && active(g).length >= MIN_PLAYERS;

export function enter(g: Game, phase: Phase, now: number, ms?: number): Game {
  return { ...g, phase, at: g.at + 1, deadline: ms === undefined ? null : now + ms, paused: null, frozen: null };
}

/** Adds events to the log, numbered. */
export function note(g: Game, events: readonly NewEvent[]): { game: Game; added: Event[] } {
  const added: Event[] = events.map((e, i) => ({ ...e, n: g.count + i + 1 }));
  return { game: { ...g, log: [...g.log, ...added].slice(-LOG_SIZE), count: g.count + added.length }, added };
}

/** Stops the clock in any phase of play. */
export const pause = (g: Game, now: number): Game =>
  g.paused !== null || g.phase === 'lobby' || g.phase === 'over' ? g : { ...g, paused: now, frozen: left(g, now) };

export const resume = (g: Game, now: number): Game =>
  g.paused === null ? g : { ...g, paused: null, frozen: null, deadline: g.frozen !== null ? now + g.frozen : g.deadline };

/** Phones get a moment to find the room again before anyone counts as gone. */
export const quiet = (g: Game, now: number): Game => ({ ...g, quiet: now + RECONNECT_MS });

/** After the host screen reloads: a timer that ran out meanwhile gets 12 s, and phones get time to reconnect. */
export const afterReload = (g: Game, now: number): Game =>
  quiet({ ...g, deadline: g.deadline !== null && g.deadline <= now ? now + 12_000 : g.deadline }, now);
