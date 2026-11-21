// Pure game rules for Brain Freeze: every step takes a state and returns the next one, so the
// screens stay thin and each step can be saved and unit-tested.
import type { HistoryEntry } from '../../lib/history';
import type { Reseat } from '../../lib/players';

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
  /** A steal uses up the stealer's own turn, so play passes to the player after them. */
  stealUsesTurn: boolean;
  packIds: string[];
  /** Whose turn it is. */
  turn: number;
  /**
   * Turns still to play in this round, the one under way included (a turn used by a steal
   * counts as played). A round is one turn per seat, so everyone has had as many turns when it ends.
   */
  left: number;
  /** Who won, decided when a round ends with one player on top at or above the target; -1 until then. */
  won: number;
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

export interface GameOptions { target: number; seconds: number; steal: boolean; stealUsesTurn: boolean; packIds: string[] }

export const promptKey = (p: string) => p.trim().toLowerCase().replace(/\s+/g, ' ');

export function newGame(names: string[], opts: GameOptions): GameState {
  if (names.length < MIN_PLAYERS) throw new Error(`Need at least ${MIN_PLAYERS} players`);
  return {
    v: 1,
    players: names.map((name) => ({ name, score: 0 })),
    target: opts.target,
    seconds: opts.seconds,
    steal: opts.steal,
    stealUsesTurn: opts.stealUsesTurn,
    packIds: opts.packIds,
    turn: 0,
    left: names.length,
    won: -1,
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
  if (s.phase !== 'handoff' || s.won >= 0) return s;
  const k = promptKey(prompt);
  const dealt = s.dealt.includes(k) ? s.dealt : [...s.dealt, k];
  return { ...s, phase: 'live', prompt, actor: s.turn, stealing: false, timeLeft: s.seconds * 1000, dealt, prev: null };
}

/**
 * Every prompt of the chosen packs was played this game: they come round again, all but the
 * last one played, so it never comes straight back.
 */
export function reshuffle(s: GameState): GameState {
  const last = s.log.at(-1)?.prompt;
  return { ...s, dealt: last ? [promptKey(last)] : [] };
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
 * miss goes to the next player when Steal is on and this was not already the steal. The turn
 * then passes on: to the next seat, or past the stealer when a steal uses their turn.
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
  const used = s.stealing && s.stealUsesTurn ? 2 : 1;
  const turn = (s.turn + used) % s.players.length;
  return {
    ...s, players, phase: 'handoff', turn, actor: turn, stealing: false, prompt: null, timeLeft: s.seconds * 1000,
    log: [...s.log, played], prev, ...countTurns(s.left - used, players, s.target),
  };
}

/**
 * The round's count after turns were played: once none is left the round is over, the one
 * player on top at or above the target wins, and otherwise a new round starts (a turn already
 * used by a steal counting towards it).
 */
function countTurns(left: number, players: Player[], target: number): Pick<GameState, 'left' | 'won'> {
  return left > 0 ? { left, won: -1 } : { left: left + players.length, won: leader(players, target) };
}

/** The one player on top at or above the target, or -1 (nobody there yet, or a tie on top). */
function leader(players: Player[], target: number): number {
  const top = Math.max(...players.map((p) => p.score));
  const tops = players.flatMap((p, i) => (p.score === top ? [i] : []));
  return top >= target && tops.length === 1 ? tops[0] : -1;
}

/** Wrong call: back to the judging of the last try, the point (if any) taken back. */
export function undo(s: GameState): GameState {
  if (!s.prev || (s.phase !== 'handoff' && s.phase !== 'steal')) return s;
  return s.prev;
}

/**
 * The saved game with the players edited in setup: everyone kept keeps their score, newcomers
 * start at 0, and a removed player leaves with their points and their own turns. A turn under
 * way when its player or stealer is removed (or a newcomer now sits between them) is dropped: the
 * player whose turn it is (or the next one still in) starts it again with a new prompt. The round goes on with whoever is still to
 * play in it (newcomers sit after the last seat, so they play in it once it has gone past there);
 * when nobody is, it ends. Undo does not reach back past the edit.
 */
export function reseat(s: GameState, r: Reseat): GameState {
  const players = r.names.map((name, i) => ({ name, score: r.seats[i] >= 0 ? (s.players[r.seats[i]]?.score ?? 0) : 0 }));
  const to = (i: number) => (i >= 0 ? (r.places[i] ?? -1) : -1);
  const log = s.log.filter((t) => to(t.player) >= 0).map((t) => ({ ...t, player: to(t.player), stealer: to(t.stealer), scorer: to(t.scorer) }));
  const ahead = seatsAhead(s, r);
  const turn = ahead.indexOf(Math.min(...ahead));
  const owed = ahead.filter((d) => d < s.left).length;
  const round = owed > 0 ? { left: owed, won: s.won >= 0 ? leader(players, s.target) : -1 } : countTurns(0, players, s.target);
  const mid = s.phase === 'live' || s.phase === 'judge' || s.phase === 'steal';
  const next = { ...s, players, log, turn, prev: null };
  if (s.phase === 'win') return { ...next, actor: turn, won: to(s.won) };
  // A steal goes on only while its stealer still sits next to the player whose turn it is.
  const keeps = to(s.turn) >= 0 && to(s.actor) >= 0 && (!s.stealing || to(s.actor) === (turn + 1) % players.length);
  if (mid && keeps) return { ...next, ...round, actor: to(s.actor) };
  return { ...next, ...round, actor: turn, stealing: false, phase: 'handoff', prompt: null, timeLeft: s.seconds * 1000 };
}

/**
 * How many seats round the circle from the turn under way each player of the edited list sits
 * (0: the player whose turn it is). Newcomers were added at the end, after the old last seat.
 */
function seatsAhead(s: GameState, r: Reseat): number[] {
  const n = s.players.length;
  return r.seats.map((k) => (k >= 0 ? (k - s.turn + n) % n : n - 1 - s.turn + 0.5));
}

/** Index of the winner, or -1 while play goes on. */
export function winner(s: GameState): number {
  return s.won;
}

/** From the hand-off at the end of the winning round to the win screen. */
export function finish(s: GameState): GameState {
  if (s.phase !== 'handoff' || s.won < 0) return s;
  return { ...s, phase: 'win', prev: null };
}

/** Same players and settings, scores back to zero; the player after the one who started this game goes first. */
export function rematch(s: GameState): GameState {
  const n = s.players.length;
  const turn = (s.turn + s.left + 1) % n; // `turn + left` is the seat that opened the round
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, score: 0 })),
    turn, actor: turn, left: n, won: -1, stealing: false, phase: 'handoff', prompt: null, timeLeft: s.seconds * 1000, log: [], prev: null,
  };
}

/**
 * The hand-off's note once someone is at or above the target and no one has won yet: a tie on
 * top ("Maya and Ben are tied on 8 — a tie when the round ends plays one more round"), else who
 * reached it ("Maya reached 7 — the rest of the round still plays"); '' otherwise. Worded from
 * the scores alone, so it reads true mid-round and at a new round after a tie.
 */
export function roundNote(s: GameState): string {
  if (s.won >= 0) return '';
  const there = s.players.filter((p) => p.score >= s.target);
  if (!there.length) return '';
  const top = Math.max(...there.map((p) => p.score));
  const tied = there.filter((p) => p.score === top);
  return tied.length > 1
    ? `${names(tied)} are tied on ${top} — a tie when the round ends plays one more round`
    : `${names(there)} reached ${s.target} — the rest of the round still plays`;
}

/** "Maya", "Maya and Ben", "Maya, Ben and Cy". */
function names(list: Player[]): string {
  const all = list.map((p) => p.name);
  return all.length < 2 ? all.join('') : `${all.slice(0, -1).join(', ')} and ${all.at(-1)}`;
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
  // The round ended with a winner but nobody tapped on to the win screen: that is still a win.
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
  const round = roundOf(s, log);
  if (s.phase === 'win' ? round.won < 0 : round.won >= 0 && s.phase !== 'handoff') return null;
  // Undo goes back one judgement only, so a saved `prev` never carries its own.
  const prev = depth === 0 && s.prev ? validGame(s.prev, 1) : null;
  return { ...s, ...round, prompt: typeof s.prompt === 'string' ? s.prompt : null, dealt: strings(s.dealt) ? s.dealt : [], log, prev: prev && { ...prev, prev: null } };
}

/**
 * The round fields of a save, filled in for one written before rounds were counted: steals
 * never used a turn, the round began at the first turn's seat, and a game was won the moment
 * someone reached the target (its hand-off already showed the winner) or by the leader on its win screen.
 */
function roundOf(s: GameState, log: Played[]): Pick<GameState, 'stealUsesTurn' | 'left' | 'won'> {
  const n = s.players.length;
  const first = log[0]?.player ?? s.turn;
  return {
    stealUsesTurn: typeof s.stealUsesTurn === 'boolean' ? s.stealUsesTurn : false,
    left: int(s.left, 1, n) ? s.left : n - ((s.turn - first + n) % n),
    won: int(s.won, -1, n - 1) ? s.won
      : s.phase === 'win' ? standings(s)[0].index
      : s.phase === 'handoff' ? s.players.findIndex((p) => p.score >= s.target) : -1,
  };
}

export interface SetupPrefs { packIds: string[] | null; seconds: number; target: number; steal: boolean; stealUsesTurn: boolean }
export const DEFAULT_SETUP: SetupPrefs = { packIds: null, seconds: 5, target: 7, steal: true, stealUsesTurn: false };

/** Saved setup choices, each field checked on its own and replaced by its default if bad. */
export function validSetup(x: unknown): SetupPrefs {
  const p = (x && typeof x === 'object' ? x : {}) as Partial<SetupPrefs>;
  return {
    packIds: strings(p.packIds) ? p.packIds : DEFAULT_SETUP.packIds,
    seconds: (SECONDS_CHOICES as readonly number[]).includes(p.seconds as number) ? (p.seconds as number) : DEFAULT_SETUP.seconds,
    target: int(p.target, TARGET_RANGE[0], TARGET_RANGE[1]) ? (p.target as number) : DEFAULT_SETUP.target,
    steal: typeof p.steal === 'boolean' ? p.steal : DEFAULT_SETUP.steal,
    stealUsesTurn: typeof p.stealUsesTurn === 'boolean' ? p.stealUsesTurn : DEFAULT_SETUP.stealUsesTurn,
  };
}
