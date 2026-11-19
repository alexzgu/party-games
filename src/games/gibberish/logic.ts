// Pure game rules for Say What?: every step takes a state and returns the next one,
// so the screens stay thin and each step can be saved and unit-tested.
import type { GibberishCard } from '../../lib/content';
import { answerKey } from './parse';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const TIMER_CHOICES = [0, 20, 30, 45, 60] as const;

export interface Player { name: string; score: number }

/** handoff: phone goes to the reader · card: reader reads · reveal: answer + scores · win: game over */
export type Phase = 'handoff' | 'card' | 'reveal' | 'win';

export type Outcome =
  | { kind: 'point'; scorer: number }
  | { kind: 'nobody' }
  | { kind: 'timeout' };

export interface GameState {
  v: 1;
  players: Player[];
  /** Points needed to win. */
  target: number;
  /** Seconds per card; 0 means no timer. */
  seconds: number;
  packIds: string[];
  /** Index into players of who reads the current card. */
  reader: number;
  phase: Phase;
  card: GibberishCard | null;
  /** Milliseconds left on the current card's timer (saved so a reload resumes it). */
  timeLeft: number;
  outcome: Outcome | null;
  cardsPlayed: number;
  /** Answers dealt so far (folded), so no answer comes up twice, even from another pack. */
  dealt: string[];
}

export interface GameOptions { target: number; seconds: number; packIds: string[] }

export function newGame(names: string[], opts: GameOptions): GameState {
  if (names.length < MIN_PLAYERS) throw new Error(`Need at least ${MIN_PLAYERS} players`);
  return {
    v: 1,
    players: names.map((name) => ({ name, score: 0 })),
    target: opts.target,
    seconds: opts.seconds,
    packIds: opts.packIds,
    reader: 0,
    phase: 'handoff',
    card: null,
    timeLeft: opts.seconds * 1000,
    outcome: null,
    cardsPlayed: 0,
    dealt: [],
  };
}

/** The reader has the phone: show them a card with a full timer. Also used for Skip. */
export function showCard(s: GameState, card: GibberishCard): GameState {
  const key = answerKey(card);
  const dealt = s.dealt.includes(key) ? s.dealt : [...s.dealt, key];
  return { ...s, phase: 'card', card, timeLeft: s.seconds * 1000, outcome: null, dealt };
}

export function tickTimer(s: GameState, timeLeft: number): GameState {
  return { ...s, timeLeft: Math.max(0, Math.round(timeLeft)) };
}

/** Someone shouted the answer. The reader cannot score their own card. */
export function award(s: GameState, scorer: number): GameState {
  if (s.phase !== 'card' || scorer === s.reader || !s.players[scorer]) return s;
  const players = s.players.map((p, i) => (i === scorer ? { ...p, score: p.score + 1 } : p));
  return { ...s, players, phase: 'reveal', outcome: { kind: 'point', scorer }, cardsPlayed: s.cardsPlayed + 1 };
}

export function noPoint(s: GameState, kind: 'nobody' | 'timeout'): GameState {
  if (s.phase !== 'card') return s;
  return { ...s, phase: 'reveal', outcome: { kind }, cardsPlayed: s.cardsPlayed + 1, timeLeft: kind === 'timeout' ? 0 : s.timeLeft };
}

/** Wrong name tapped: take the point back and return to the same card. */
export function undo(s: GameState): GameState {
  if (s.phase !== 'reveal' || !s.outcome) return s;
  const o = s.outcome;
  const players = o.kind === 'point' ? s.players.map((p, i) => (i === o.scorer ? { ...p, score: p.score - 1 } : p)) : s.players;
  const timeLeft = o.kind === 'timeout' ? s.seconds * 1000 : s.timeLeft;
  return { ...s, players, phase: 'card', outcome: null, timeLeft, cardsPlayed: s.cardsPlayed - 1 };
}

/** Index of the player who reached the target, or -1. */
export function winner(s: GameState): number {
  return s.players.findIndex((p) => p.score >= s.target);
}

/** After the reveal: either the game is won, or the next player in the circle reads. */
export function next(s: GameState): GameState {
  if (s.phase !== 'reveal') return s;
  if (winner(s) >= 0) return { ...s, phase: 'win' };
  return { ...s, phase: 'handoff', reader: (s.reader + 1) % s.players.length, card: null, outcome: null, timeLeft: s.seconds * 1000 };
}

/** Same players and settings, scores back to zero; the next player in the circle reads first. */
export function rematch(s: GameState): GameState {
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, score: 0 })),
    reader: (s.reader + 1) % s.players.length,
    phase: 'handoff', card: null, outcome: null, timeLeft: s.seconds * 1000, cardsPlayed: 0,
  };
}

/** Players ordered for the scoreboard: highest score first, ties keep seating order. */
export function standings(s: GameState): { player: Player; index: number }[] {
  return s.players.map((player, index) => ({ player, index })).sort((a, b) => b.player.score - a.player.score || a.index - b.index);
}

/** Cleans a typed name and reports why it cannot be added, if it cannot. */
export function checkName(raw: string, existing: string[]): { name: string; error: string } {
  const name = raw.trim().replace(/\s+/g, ' ').slice(0, 18);
  if (!name) return { name, error: 'Type a name first.' };
  if (existing.some((n) => n.toLowerCase() === name.toLowerCase())) return { name, error: `${name} is already playing.` };
  if (existing.length >= MAX_PLAYERS) return { name, error: `${MAX_PLAYERS} players is the most.` };
  return { name, error: '' };
}

const num = (x: unknown, min: number, max = Infinity): x is number => typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
const strings = (x: unknown): x is string[] => Array.isArray(x) && x.every((v) => typeof v === 'string');
const isCard = (c: unknown): c is GibberishCard => {
  const k = c as GibberishCard | null;
  return !!k && typeof k.phrase === 'string' && k.phrase !== '' && typeof k.answer === 'string' && (k.hint === undefined || typeof k.hint === 'string');
};

/**
 * A saved game from localStorage, or null if missing or not the shape this version writes.
 * Every field a screen reads is checked, so a damaged save falls back to setup instead of
 * breaking the app on every reload.
 */
export function validGame(x: unknown): GameState | null {
  const s = x as GameState | null;
  if (!s || typeof s !== 'object' || s.v !== 1 || !Array.isArray(s.players) || s.players.length < MIN_PLAYERS) return null;
  if (!s.players.every((p) => typeof p?.name === 'string' && num(p.score, 0))) return null;
  if (!['handoff', 'card', 'reveal', 'win'].includes(s.phase)) return null;
  if (!Number.isInteger(s.reader) || s.reader < 0 || s.reader >= s.players.length) return null;
  if (!num(s.target, 1) || !num(s.seconds, 0, 600) || !num(s.timeLeft, 0) || !num(s.cardsPlayed, 0)) return null;
  if (!strings(s.packIds)) return null;
  if (s.card !== null && s.card !== undefined && !isCard(s.card)) return null;
  if ((s.phase === 'card' || s.phase === 'reveal') && !s.card) return null;
  if (s.phase === 'reveal') {
    const o = s.outcome;
    if (!o || !['point', 'nobody', 'timeout'].includes(o.kind)) return null;
    if (o.kind === 'point' && !(Number.isInteger(o.scorer) && o.scorer >= 0 && o.scorer < s.players.length)) return null;
  }
  return { ...s, card: s.card ?? null, outcome: s.phase === 'reveal' ? s.outcome : null, dealt: strings(s.dealt) ? s.dealt : [] };
}

export interface SetupPrefs { packIds: string[] | null; seconds: number; target: number }
export const DEFAULT_SETUP: SetupPrefs = { packIds: null, seconds: 30, target: 5 };
export const TARGET_RANGE = [2, 15] as const;

/** Saved setup choices, each field checked on its own and replaced by its default if bad. */
export function validSetup(x: unknown): SetupPrefs {
  const p = (x && typeof x === 'object' ? x : {}) as Partial<SetupPrefs>;
  return {
    packIds: strings(p.packIds) ? p.packIds : DEFAULT_SETUP.packIds,
    seconds: (TIMER_CHOICES as readonly number[]).includes(p.seconds as number) ? (p.seconds as number) : DEFAULT_SETUP.seconds,
    target: Number.isInteger(p.target) && num(p.target, TARGET_RANGE[0], TARGET_RANGE[1]) ? (p.target as number) : DEFAULT_SETUP.target,
  };
}
