// Would You Rather's game state on the host, and the small reads every other module shares.

export const NAME_MAX = 20;
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
/** Questions in one game. */
export const COUNTS = [10, 15, 20] as const;
/** Seconds to vote; 0 is no limit (the host's advance button reveals). */
export const VOTE_TIMES = [15, 20, 30, 0] as const;
export const REVEAL_MS = 10_000;
/** After the host screen opens or changes broker, how long phones get to reconnect before anyone counts as gone (*house*). */
export const RECONNECT_MS = 10_000;

export type Settings = { count: number; seconds: number; packs: string[] };
export const DEFAULT_SETTINGS: Settings = { count: 10, seconds: 20, packs: ['classic'] };

export type Phase = 'lobby' | 'vote' | 'reveal' | 'over';
/** The first choice (0) or the second (1). */
export type Side = 0 | 1;
export type Player = { pid: string; name: string; score: number };
/** A question's outcome: votes per side, who voted which way (seat order), and the bigger side (null: a tie or no votes). */
export type Tally = { counts: [number, number]; voters: [string[], string[]]; winner: Side | null };
export type Round = {
  /** The question's number in this game, from 1. */
  n: number; prompt: string;
  /** Each player's latest tap; only those still in the game at the reveal count. */
  votes: Record<string, Side>;
  tally: Tally | null;
};
/** A question already revealed, for History. */
export type Past = { prompt: string; counts: [number, number]; winner: Side | null };
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
  /** This game's questions, in the order asked. */
  questions: string[];
  round: Round | null; results: Past[];
  /** The keys (`ratherKey`) of the questions this room has asked, never their text: the next game asks others while the picks have them. */
  asked: string[];
};

export const newGame = (id: string, code: string, settings: Settings): Game => ({
  id, code, settings, phase: 'lobby', at: 0, deadline: null, paused: null, frozen: null, quiet: null,
  players: [], kicked: [], left: [], questions: [], round: null, results: [], asked: [],
});

export const active = (g: Game) => g.players.filter((p) => !g.kicked.includes(p.pid));
export const isActive = (g: Game, pid: string) => g.players.some((p) => p.pid === pid) && !g.kicked.includes(pid);
export const standings = (g: Game) => [...active(g)].sort((a, b) => b.score - a.score);
export const left = (g: Game, now: number) => g.paused !== null ? g.frozen : g.deadline === null ? null : Math.max(0, g.deadline - now);
export const reconnecting = (g: Game, now: number) => g.quiet !== null && now < g.quiet;
export const canStart = (g: Game) => g.phase === 'lobby' && active(g).length >= MIN_PLAYERS;

export function enter(g: Game, phase: Phase, now: number, ms?: number): Game {
  return { ...g, phase, at: g.at + 1, deadline: ms === undefined ? null : now + ms, paused: null, frozen: null };
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
