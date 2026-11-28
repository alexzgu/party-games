// Big 2's game state on the host, and the small reads every other module shares.
import type { Card } from '../../lib/cards/deck';
import { active, isActive, type Player } from '../../lib/room/seating';
import * as T from '../../lib/room/table';
import type { Combo } from './combos';

export { RECONNECT_MS, left, reconnecting, pause, resume, quiet, afterReload } from '../../lib/room/table';
export { active, isActive, type Player } from '../../lib/room/seating';

export const NAME_MAX = 20;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
/** Cards each, from one 52-card deck; with 2 or 3 players the rest is set aside unseen (*house*). */
export const HAND_SIZE = 13;
/** Deals per game. */
export const DEAL_COUNTS = [1, 3, 5] as const;
/** Seconds per turn; 0 is no limit (the host's advance plays for the player). */
export const TURN_TIMES = [20, 30, 45, 0] as const;
/** How long a deal's result stays up before the next deal. */
export const RESULT_MS = 10_000;
/** Events the views carry. */
export const LOG_SIZE = 8;

export type Settings = { deals: number; seconds: number };
export const DEFAULT_SETTINGS: Settings = { deals: 3, seconds: 30 };

/** `turn`: waiting for a player's play or pass; `result`: a deal's points are up before the next. */
export type Phase = 'lobby' | 'turn' | 'result' | 'over';

/**
 * What happened, in order; `n` counts the game's events from 1. `play`: `by` put `cards` on the
 * table. `pass`: `by` passed and is out until the trick ends. `lead`: `by` leads a new trick.
 * `done`: `by` has no cards left and the deal ends. `gone`: `by` left or was removed, their
 * cards set aside. `deal`: deal `deal` begins.
 */
export type NewEvent =
  | { k: 'play'; by: string; cards: Card[] }
  | { k: 'pass'; by: string }
  | { k: 'lead'; by: string }
  | { k: 'done'; by: string }
  | { k: 'gone'; by: string }
  | { k: 'deal'; deal: number };
export type Event = NewEvent & { n: number };

/** The play on the table and who made it. */
export type Play = { by: string; combo: Combo };
/** A finished deal: who went out, and each player's cards left and penalty points. */
export type Result = { out: string; rows: { pid: string; cards: number; points: number }[] };

export type Game = T.Clocked & T.Logged<NewEvent> & {
  id: string; code: string; settings: Settings; phase: Phase;
  players: Player[]; kicked: string[];
  /** Players out by their own choice ("Leave room"), among `kicked` until they come back. */
  left: string[];
  /** The game's players in seat order, fixed at the first deal; late joiners wait for the next game. */
  roster: string[];
  /** The players dealt in this deal, in seat order (the turn goes round them). */
  seats: string[];
  hands: Record<string, Card[]>;
  /** Cards each player held when they went out of this deal (left or removed), for the points. */
  gone: Record<string, number>;
  /** Penalty points so far. */
  totals: Record<string, number>;
  /** The deal in play, from 1. */
  deal: number;
  turn: string | null;
  /** The play to beat (null: whoever is on turn leads). */
  table: Play | null;
  /** Who passed in this trick. */
  passed: string[];
  /** The card the deal's first play must hold (the lowest dealt), until it is played. */
  first: Card | null;
  /** The last deal's result. */
  result: Result | null;
};

export const newGame = (id: string, code: string, settings: Settings): Game => ({
  id, code, settings, phase: 'lobby', at: 0, deadline: null, paused: null, frozen: null, quiet: null,
  players: [], kicked: [], left: [], roster: [], seats: [], hands: {}, gone: {}, totals: {}, deal: 0,
  turn: null, table: null, passed: [], first: null, result: null, log: [], count: 0,
});

/** Dealt in this deal and still in the game. */
export const playing = (g: Game, pid: string) => g.seats.includes(pid) && isActive(g, pid);
export const hand = (g: Game, pid: string): Card[] => g.hands[pid] ?? [];
export const total = (g: Game, pid: string) => g.totals[pid] ?? 0;
/** The game's players still in it, fewest points first (ties keep seat order). */
export const standings = (g: Game) => g.roster.filter((pid) => isActive(g, pid))
  .map((pid) => g.players.find((p) => p.pid === pid)!)
  .sort((a, b) => total(g, a.pid) - total(g, b.pid));
export const canStart = (g: Game) => g.phase === 'lobby' && active(g).length >= MIN_PLAYERS;

export const enter = (g: Game, phase: Phase, now: number, ms?: number): Game => T.enter(g, phase, now, ms);
export const note = (g: Game, events: readonly NewEvent[]): Game => T.note(g, events, LOG_SIZE).game;
