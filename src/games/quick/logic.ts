// Pure game rules for Brain Freeze: every step takes a state and returns the next one, so the
// screens stay thin and each step can be saved and unit-tested.
import type { HistoryEntry } from '../../lib/history';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;
export const SECONDS_CHOICES = [5, 7, 10] as const;
export const TARGET_RANGE = [3, 15] as const;

export interface Player { name: string; score: number }

/**
 * handoff: the phone goes to whoever is up (and shows how the last turn went) ·
 * live: the prompt is up and the clock runs · judge: time ran out, the room decides ·
 * steal: the miss goes to the next player · win: game over
 */
export type Phase = 'handoff' | 'live' | 'judge' | 'steal' | 'win';

/** One finished turn: whose it was, who tried to steal it (-1: nobody) and who scored (-1: nobody). */
export interface Played { prompt: string; player: number; stealer: number; scorer: number }

export interface GameState {
  v: 1;
  players: Player[];
  /** Points needed to win. */
  target: number;
  /** Seconds on the clock for each try. */
  seconds: number;
  /** A missed prompt goes to the next player for the point. */
  steal: boolean;
  packIds: string[];
  /** Whose turn it is. */
  turn: number;
  /** Who is answering right now: the turn's player, or the stealer during a steal. */
  actor: number;
  stealing: boolean;
  phase: Phase;
  prompt: string | null;
  /** Milliseconds left on the clock (saved so a reload resumes it). */
  timeLeft: number;
  /** Prompts dealt this game (folded), so none comes up twice, even from another pack. */
  dealt: string[];
  /** Finished turns, oldest first: the last one is shown at the hand-off, all go to History. */
  log: Played[];
  /** The game as it stood before the last judgement, for Undo; null when there is nothing to undo. */
  prev: GameState | null;
}

export interface GameOptions { target: number; seconds: number; steal: boolean; packIds: string[] }

export const promptKey = (p: string) => p.trim().toLowerCase().replace(/\s+/g, ' ');

export function newGame(names: string[], opts: GameOptions): GameState {
  if (names.length < MIN_PLAYERS) throw new Error(`Need at least ${MIN_PLAYERS} players`);
  return {
    v: 1,
    players: names.map((name) => ({ name, score: 0 })),
    target: opts.target,
    seconds: opts.seconds,
    steal: opts.steal,
    packIds: opts.packIds,
    turn: 0,
    actor: 0,
    stealing: false,
    phase: 'handoff',
    prompt: null,
    timeLeft: opts.seconds * 1000,
    dealt: [],
    log: [],
    prev: null,
  };
}

/** The player who is up tapped: show the prompt and start the clock. */
export function reveal(s: GameState, prompt: string): GameState {
  if (s.phase !== 'handoff' || winner(s) >= 0) return s;
  const k = promptKey(prompt);
  const dealt = s.dealt.includes(k) ? s.dealt : [...s.dealt, k];
  return { ...s, phase: 'live', prompt, actor: s.turn, stealing: false, timeLeft: s.seconds * 1000, dealt, prev: null };
}

/** The stealer has the phone: same prompt, full clock. */
export function startSteal(s: GameState): GameState {
  if (s.phase !== 'steal') return s;
  return { ...s, phase: 'live', timeLeft: s.seconds * 1000, prev: null };
}

export function tickTimer(s: GameState, timeLeft: number): GameState {
  return { ...s, timeLeft: Math.max(0, Math.round(timeLeft)) };
}

/** The buzzer went: the room judges. */
export function timeUp(s: GameState): GameState {
  if (s.phase !== 'live') return s;
  return { ...s, phase: 'judge', timeLeft: 0 };
}

/**
 * The room's call, during the clock ("got all 3" early) or after it. A point ends the turn; a
 * miss goes to the next player when Steal is on and this was not already the steal.
 */
export function judge(s: GameState, got: boolean): GameState {
  if (s.phase !== 'live' && s.phase !== 'judge') return s;
  const prev: GameState = { ...s, phase: 'judge', timeLeft: 0, prev: null };
  if (!got && s.steal && !s.stealing) {
    return { ...s, phase: 'steal', stealing: true, actor: (s.turn + 1) % s.players.length, timeLeft: s.seconds * 1000, prev };
  }
  const scorer = got ? s.actor : -1;
  const players = s.players.map((p, i) => (i === scorer ? { ...p, score: p.score + 1 } : p));
  const played: Played = { prompt: s.prompt ?? '', player: s.turn, stealer: s.stealing ? s.actor : -1, scorer };
  const turn = (s.turn + 1) % s.players.length;
  return { ...s, players, phase: 'handoff', turn, actor: turn, stealing: false, prompt: null, timeLeft: s.seconds * 1000, log: [...s.log, played], prev };
}

/** Wrong call: back to the judging of the last try, the point (if any) taken back. */
export function undo(s: GameState): GameState {
  if (!s.prev || (s.phase !== 'handoff' && s.phase !== 'steal')) return s;
  return s.prev;
}

/** Index of the player who reached the target, or -1. Only one point is given per turn, so at most one. */
export function winner(s: GameState): number {
  return s.players.findIndex((p) => p.score >= s.target);
}

/** From the hand-off after the winning point to the win screen. */
export function finish(s: GameState): GameState {
  if (s.phase !== 'handoff' || winner(s) < 0) return s;
  return { ...s, phase: 'win', prev: null };
}

/** Same players and settings, scores back to zero; the next player in the circle goes first. */
export function rematch(s: GameState): GameState {
  const turn = s.turn; // already moved on past the last turn played
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, score: 0 })),
    turn, actor: turn, stealing: false, phase: 'handoff', prompt: null, timeLeft: s.seconds * 1000, log: [], prev: null,
  };
}

/** Players ordered for the scoreboard: highest score first, ties keep seating order. */
export function standings(s: GameState): { player: Player; index: number }[] {
  return s.players.map((player, index) => ({ player, index })).sort((a, b) => b.player.score - a.player.score || a.index - b.index);
}

/** The history entry for a finished game: "Sam won 7–4–2", every score, one line per turn. */
export function gameRecord(s: GameState, packs: string[]): Omit<HistoryEntry, 'id' | 'at'> {
  const rows = standings(s);
  return { ...entry(s, packs, `${rows[0]?.player.name ?? 'Nobody'} won ${line(s)}`), finished: true };
}

/**
 * The history entry for a game thrown away before it was won ("Maya led 3–2–1"), or null when
 * no turn was finished. A game already won is recorded by the win itself.
 */
export function endedRecord(s: GameState, packs: string[]): Omit<HistoryEntry, 'id' | 'at'> | null {
  if (s.phase === 'win' || s.log.length === 0) return null;
  // Someone reached the target but nobody tapped on to the win screen: that is still a win.
  if (winner(s) >= 0) return gameRecord(s, packs);
  const rows = standings(s);
  const best = rows[0].player.score;
  const leaders = rows.filter((r) => r.player.score === best).map((r) => r.player.name);
  const lead = best === 0 ? 'Nobody scored' : leaders.length === 1 ? `${leaders[0]} led` : leaders.length === 2 ? `${leaders.join(' and ')} tied` : `${leaders.length}-way tie`;
  return { ...entry(s, packs, `${lead} ${line(s)}`), finished: false };
}

const line = (s: GameState) => standings(s).map((r) => r.player.score).join('–');

/** "Name 3 pizza toppings: Maya ✓" or "…: Maya ✗, Jordan stole it". */
export function turnLine(s: GameState, t: Played): string {
  const name = (i: number) => s.players[i]?.name ?? '?';
  let out = `Name 3 ${t.prompt}: ${name(t.player)} ${t.scorer === t.player ? '✓' : '✗'}`;
  if (t.stealer >= 0) out += t.scorer === t.stealer ? `, ${name(t.stealer)} stole it` : `, ${name(t.stealer)} ✗ too`;
  return out;
}

function entry(s: GameState, packs: string[], title: string): Omit<HistoryEntry, 'id' | 'at'> {
  return {
    game: 'quick',
    title,
    scores: standings(s).map((r) => ({ name: r.player.name, score: r.player.score })),
    packs,
    details: s.log.map((t) => turnLine(s, t)),
  };
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
const int = (x: unknown, min: number, max: number) => Number.isInteger(x) && num(x, min, max);
const strings = (x: unknown): x is string[] => Array.isArray(x) && x.every((v) => typeof v === 'string');
const PHASES: Phase[] = ['handoff', 'live', 'judge', 'steal', 'win'];

/**
 * A saved game from localStorage, or null if missing or not the shape this version writes.
 * Every field a screen reads is checked, so a damaged save falls back to setup instead of
 * breaking the app on every reload.
 */
export function validGame(x: unknown, depth = 0): GameState | null {
  const s = x as GameState | null;
  if (!s || typeof s !== 'object' || s.v !== 1 || !Array.isArray(s.players) || s.players.length < MIN_PLAYERS) return null;
  const n = s.players.length;
  if (!s.players.every((p) => typeof p?.name === 'string' && num(p.score, 0))) return null;
  if (!PHASES.includes(s.phase)) return null;
  if (!int(s.turn, 0, n - 1) || !int(s.actor, 0, n - 1) || typeof s.stealing !== 'boolean' || typeof s.steal !== 'boolean') return null;
  if (!num(s.target, 1) || !num(s.seconds, 1, 600) || !num(s.timeLeft, 0) || !strings(s.packIds)) return null;
  if (['live', 'judge', 'steal'].includes(s.phase) && (typeof s.prompt !== 'string' || !s.prompt)) return null;
  const log = Array.isArray(s.log) ? s.log.filter((t) => typeof t?.prompt === 'string' && int(t.player, 0, n - 1) && int(t.stealer, -1, n - 1) && int(t.scorer, -1, n - 1)) : [];
  // Undo goes back one judgement only, so a saved `prev` never carries its own.
  const prev = depth === 0 && s.prev ? validGame(s.prev, 1) : null;
  return { ...s, prompt: typeof s.prompt === 'string' ? s.prompt : null, dealt: strings(s.dealt) ? s.dealt : [], log, prev: prev && { ...prev, prev: null } };
}

export interface SetupPrefs { packIds: string[] | null; seconds: number; target: number; steal: boolean }
export const DEFAULT_SETUP: SetupPrefs = { packIds: null, seconds: 5, target: 7, steal: true };

/** Saved setup choices, each field checked on its own and replaced by its default if bad. */
export function validSetup(x: unknown): SetupPrefs {
  const p = (x && typeof x === 'object' ? x : {}) as Partial<SetupPrefs>;
  return {
    packIds: strings(p.packIds) ? p.packIds : DEFAULT_SETUP.packIds,
    seconds: (SECONDS_CHOICES as readonly number[]).includes(p.seconds as number) ? (p.seconds as number) : DEFAULT_SETUP.seconds,
    target: int(p.target, TARGET_RANGE[0], TARGET_RANGE[1]) ? (p.target as number) : DEFAULT_SETUP.target,
    steal: typeof p.steal === 'boolean' ? p.steal : DEFAULT_SETUP.steal,
  };
}
