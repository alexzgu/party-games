// Bad Hand's game state on the host, and the small reads every other module shares.
import { draw, type Rand } from './deck';

export const NAME_MAX = 20;
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 10;
/** Cards in a full hand. */
export const HAND = 10;
/** Seconds to answer; 0 is no limit. */
export const ANSWER_TIMES = [45, 60, 90, 0] as const;
export const TARGETS = [5, 7, 10] as const;
export const VOTE_MS = 30_000;
export const REVEAL_MS = 8_000;
/** How long a judge may be offline during judging before the room votes instead. */
export const JUDGE_AWAY_MS = 20_000;
/** After the host screen opens or changes broker, how long phones get to reconnect before anyone counts as gone (*house*). */
export const RECONNECT_MS = 10_000;
/** The house player's id, in plays and results. */
export const HOUSE = 'house';

export type Settings = { seconds: number; target: number; packs: string[]; trade: boolean; house: boolean; blanks: boolean };
export const DEFAULT_SETTINGS: Settings = { seconds: 60, target: 7, packs: ['classic'], trade: false, house: false, blanks: false };

export type Phase = 'lobby' | 'answer' | 'judge' | 'vote' | 'reveal' | 'over';
export type Player = { pid: string; name: string; score: number };
/** A played answer: its card ids and their texts (a blank card's text is what its player typed). */
export type Play = { cards: number[]; texts: string[] };
export type Round = {
  n: number; judge: string; prompt: string;
  /** Who answers this prompt (everyone dealt in before it, but the judge). */
  players: string[];
  plays: Record<string, Play>;
  /** The answers' authors in the shuffled order shown, from judging on. */
  order: string[];
  spotlight: number | null;
  votes: Record<string, number>;
  /** When the judge's phone dropped during judging. */
  away: number | null;
  winner: number | null;
  /** The room voted (the judge was missing). */
  voted: boolean;
};
/** A round's winning answer, for the end screen. */
export type Win = { prompt: string; texts: string[]; by: string };
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
  /** Answer card texts by id ('' is a blank card). */
  cards: string[]; deck: number[]; discard: number[]; hands: Record<string, number[]>;
  /** Every prompt of the chosen packs, and those not dealt yet. */
  pool: string[]; prompts: string[];
  round: Round | null; house: number; results: Win[];
  /** Each player's count of point trades, so a re-sent trade is done once. */
  traded: Record<string, number>;
};

export const newGame = (id: string, code: string, settings: Settings): Game => ({
  id, code, settings, phase: 'lobby', at: 0, deadline: null, paused: null, frozen: null, quiet: null, players: [], kicked: [], left: [],
  cards: [], deck: [], discard: [], hands: {}, pool: [], prompts: [], round: null, house: 0, results: [], traded: {},
});

export const active = (g: Game) => g.players.filter((p) => !g.kicked.includes(p.pid));
export const isActive = (g: Game, pid: string) => g.players.some((p) => p.pid === pid) && !g.kicked.includes(pid);
export const standings = (g: Game) => [...active(g)].sort((a, b) => b.score - a.score);
export const left = (g: Game, now: number) => g.paused !== null ? g.frozen : g.deadline === null ? null : Math.max(0, g.deadline - now);
export const reconnecting = (g: Game, now: number) => g.quiet !== null && now < g.quiet;
export const canStart = (g: Game) => g.phase === 'lobby' && active(g).length >= MIN_PLAYERS;
export const isBlank = (g: Game, id: number) => g.cards[id] === '';

export function enter(g: Game, phase: Phase, now: number, ms?: number): Game {
  return { ...g, phase, at: g.at + 1, deadline: ms === undefined ? null : now + ms, paused: null, frozen: null };
}

/** Tops a player's hand back up to ten. */
export function deal(g: Game, pid: string, rand: Rand): Game {
  const hand = g.hands[pid] ?? [];
  if (hand.length >= HAND) return g;
  const { pile, cards } = draw(g, HAND - hand.length, rand);
  return { ...g, ...pile, hands: { ...g.hands, [pid]: [...hand, ...cards] } };
}

/** Stops the clock in any phase of play, the missing judge's 20 s included. */
export const pause = (g: Game, now: number): Game =>
  g.paused !== null || g.phase === 'lobby' || g.phase === 'over' ? g : { ...g, paused: now, frozen: left(g, now) };

export function resume(g: Game, now: number): Game {
  if (g.paused === null) return g;
  const away = g.round?.away;
  const round = g.round && away !== null && away !== undefined ? { ...g.round, away: away + now - g.paused } : g.round;
  return { ...g, round, paused: null, frozen: null, deadline: g.frozen !== null ? now + g.frozen : g.deadline };
}

/** Phones get a moment to find the room again before anyone counts as gone. */
export const quiet = (g: Game, now: number): Game => ({ ...g, quiet: now + RECONNECT_MS });

/** After the host screen reloads: a timer that ran out meanwhile gets 12 s, the judge's absence starts over, and phones get time to reconnect. */
export function afterReload(g: Game, now: number): Game {
  const round = g.round && { ...g.round, away: null };
  return quiet({ ...g, round, deadline: g.deadline !== null && g.deadline <= now ? now + 12_000 : g.deadline }, now);
}
