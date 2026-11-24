// Pure game rules for Odd One Out: every step takes a state and returns the next one, so the
// screens stay thin and each step can be saved and unit-tested. Which secret screen is open is
// never part of the state: a saved game is always on a hand-off, never on a secret.
import type { HistoryEntry } from '../../lib/history';
import { pick } from '../../lib/random';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;
export const ROUNDS_RANGE = [3, 10] as const;

/** Points (house values): the odd one not caught, the odd one caught but naming the word, everyone else when it misses. */
export const POINTS = { escaped: 2, guessed: 1, caught: 1 } as const;

export interface Player { name: string; score: number }

/** The word of a round and the name of the pack it came from. */
export interface Secret { word: string; pack: string }

export interface Round extends Secret {
  /** The odd one out, by seat. */
  odd: number;
  /** Who gives the first clue, by seat. */
  starter: number;
  /** Who the room picked, by seat; -1 before the vote. */
  picked: number;
  /** The word is on screen after the vote (the odd one caught has had their guess). */
  shown: boolean;
  /** Caught: whether the odd one named the word; null when not caught or not yet judged. */
  guessed: boolean | null;
}

/**
 * pass: the phone goes round, `seat` is whose hand-off is up · clues: the room gives one-word
 * clues · vote: the phone records the room's pick · reveal: who it was, the guess, the word ·
 * scores: between rounds · win: game over
 */
export type Phase = 'pass' | 'clues' | 'vote' | 'reveal' | 'scores' | 'win';

export interface GameOptions { rounds: number; hint: boolean; oddNeverStarts: boolean; packIds: string[] }

export interface GameState extends GameOptions {
  v: 1;
  players: Player[];
  phase: Phase;
  seat: number;
  round: Round;
  /** Finished rounds, oldest first. */
  log: Round[];
  /** Words dealt this game (folded), so none comes up twice in it. */
  used: string[];
}

export const wordKey = (w: string) => w.trim().toLowerCase().replace(/\s+/g, ' ');

/** A new round on `secret`: a random odd one out and a random starter (never the odd one when the option is on). */
export function dealRound(players: number, secret: Secret, oddNeverStarts: boolean, rand: () => number = Math.random): Round {
  const seats = Array.from({ length: players }, (_, i) => i);
  const odd = pick(seats, rand);
  const starter = pick(oddNeverStarts ? seats.filter((i) => i !== odd) : seats, rand);
  return { ...secret, odd, starter, picked: -1, shown: false, guessed: null };
}

export function newGame(names: string[], opts: GameOptions, secret: Secret, rand: () => number = Math.random): GameState {
  if (names.length < MIN_PLAYERS) throw new Error(`Need at least ${MIN_PLAYERS} players`);
  return {
    v: 1, ...opts,
    players: names.map((name) => ({ name, score: 0 })),
    phase: 'pass', seat: 0, log: [], used: [wordKey(secret.word)],
    round: dealRound(names.length, secret, opts.oddNeverStarts, rand),
  };
}

/** The next round, from the scores screen. */
export function nextRound(s: GameState, secret: Secret, rand: () => number = Math.random): GameState {
  if (s.phase !== 'scores') return s;
  const k = wordKey(secret.word);
  return { ...s, phase: 'pass', seat: 0, used: s.used.includes(k) ? s.used : [...s.used, k], round: dealRound(s.players.length, secret, s.oddNeverStarts, rand) };
}

/** What the player at `seat` sees on their secret screen: the word, or that they are the odd one out. */
export function secretFor(s: GameState, seat: number): { odd: boolean; word: string; pack: string } {
  const odd = seat === s.round.odd;
  return { odd, word: odd ? '' : s.round.word, pack: odd && !s.hint ? '' : s.round.pack };
}

/** The player on the hand-off hid their secret: the next hand-off, or the clues after the last player. */
export function hide(s: GameState): GameState {
  if (s.phase !== 'pass') return s;
  return s.seat + 1 < s.players.length ? { ...s, seat: s.seat + 1 } : { ...s, phase: 'clues', seat: 0 };
}

/** Back from a hand-off: the previous player's hand-off (never their secret). Null at the first. */
export function passBack(s: GameState): GameState | null {
  return s.phase === 'pass' && s.seat > 0 ? { ...s, seat: s.seat - 1 } : null;
}

/** The clue order: every seat once, in list order from the starter. */
export function clueOrder(s: GameState): number[] {
  const n = s.players.length;
  return Array.from({ length: n }, (_, i) => (s.round.starter + i) % n);
}

export const toVote = (s: GameState): GameState => (s.phase === 'clues' ? { ...s, phase: 'vote' } : s);

/** The room's pick. A wrong pick shows the word at once; a right one waits for the odd one's guess. */
export function vote(s: GameState, picked: number): GameState {
  if (s.phase !== 'vote' || picked < 0 || picked >= s.players.length) return s;
  const caught = picked === s.round.odd;
  return { ...s, phase: 'reveal', round: { ...s.round, picked, shown: !caught } };
}

export const caught = (r: Round) => r.picked >= 0 && r.picked === r.odd;

/** The odd one caught has said their guess: show the word. */
export const showWord = (s: GameState): GameState => (s.phase === 'reveal' ? { ...s, round: { ...s.round, shown: true } } : s);

/** Each seat's points for a finished round. */
export function roundPoints(r: Round, players: number): number[] {
  const pts = Array<number>(players).fill(0);
  if (!caught(r)) pts[r.odd] = POINTS.escaped;
  else if (r.guessed) pts[r.odd] = POINTS.guessed;
  else return pts.map((_, i) => (i === r.odd ? 0 : POINTS.caught));
  return pts;
}

/** Scores the round (`guessed` only counts when the odd one was caught) and moves on to the scores, or the win after the last round. */
export function settle(s: GameState, guessed: boolean | null): GameState {
  if (s.phase !== 'reveal' || !s.round.shown) return s;
  const round: Round = { ...s.round, guessed: caught(s.round) ? !!guessed : null };
  const pts = roundPoints(round, s.players.length);
  const players = s.players.map((p, i) => ({ ...p, score: p.score + pts[i] }));
  const log = [...s.log, round];
  return { ...s, players, round, log, phase: log.length >= s.rounds ? 'win' : 'scores' };
}

/** Same players and options, scores back to zero, on a new word. */
export function rematch(s: GameState, secret: Secret, rand: () => number = Math.random): GameState {
  const fresh = { ...s, players: s.players.map((p) => ({ ...p, score: 0 })), log: [], phase: 'scores' as const };
  return nextRound(fresh, secret, rand);
}

/** Players ordered for the scoreboard: highest score first, ties keep list order. */
export function standings(s: Pick<GameState, 'players'>): { player: Player; index: number }[] {
  return s.players.map((player, index) => ({ player, index })).sort((a, b) => b.player.score - a.player.score || a.index - b.index);
}

/** The top score's players, by seat (several on a tie). */
export function leaders(s: Pick<GameState, 'players'>): number[] {
  const top = Math.max(...s.players.map((p) => p.score));
  return s.players.flatMap((p, i) => (p.score === top ? [i] : []));
}

/** "Maya", "Maya and Ben", "Maya, Ben and Cy". */
export function joinNames(list: string[]): string {
  return list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list.at(-1)}`;
}

/** One History line: "Round 2 · Pizza: Maya was the odd one out, caught, named the word". */
export function roundLine(s: Pick<GameState, 'players'>, r: Round, i: number): string {
  const name = s.players[r.odd]?.name ?? '?';
  const how = !caught(r) ? 'not caught' : r.guessed ? 'caught, named the word' : 'caught, missed the word';
  return `Round ${i + 1} · ${r.word}: ${name} was the odd one out, ${how}`;
}

const line = (s: GameState) => standings(s).map((r) => r.player.score).join('–');

function entry(s: GameState, packs: string[], title: string): Omit<HistoryEntry, 'id' | 'at'> {
  return {
    game: 'odd', title, packs,
    scores: standings(s).map((r) => ({ name: r.player.name, score: r.player.score })),
    details: s.log.map((r, i) => roundLine(s, r, i)),
  };
}

function leadTitle(s: GameState, verb: string): string {
  const top = leaders(s).map((i) => s.players[i].name);
  if (s.players[leaders(s)[0]].score === 0) return `Nobody scored ${line(s)}`;
  return `${top.length === 1 ? `${top[0]} ${verb}` : top.length === 2 ? `${top.join(' and ')} tied` : `${top.length}-way tie`} ${line(s)}`;
}

/** The History entry for a game played to its last round: "Sam won 5–3–2". */
export function gameRecord(s: GameState, packs: string[]): Omit<HistoryEntry, 'id' | 'at'> {
  return { ...entry(s, packs, leadTitle(s, 'won')), finished: true };
}

/** The History entry for a game thrown away early ("Maya led 3–2–1"), or null when no round was finished or it was already won. */
export function endedRecord(s: GameState, packs: string[]): Omit<HistoryEntry, 'id' | 'at'> | null {
  if (s.phase === 'win' || s.log.length === 0) return null;
  return { ...entry(s, packs, leadTitle(s, 'led')), finished: false };
}

/**
 * New game over a saved one: null when no word could be dealt (the saved game stays, unrecorded),
 * else the new game and the saved game's History entry when one is owed (`packs`: its pack names).
 */
export function startOver(saved: GameState | null, names: string[], opts: GameOptions, secret: Secret | undefined, packs: string[], rand: () => number = Math.random): { game: GameState; ended: Omit<HistoryEntry, 'id' | 'at'> | null } | null {
  if (!secret) return null;
  return { game: newGame(names, opts, secret, rand), ended: saved ? endedRecord(saved, packs) : null };
}

/** Cleans a typed name and reports why it cannot be added, if it cannot. */
export function checkName(raw: string, existing: string[]): { name: string; error: string } {
  const name = raw.trim().replace(/\s+/g, ' ').slice(0, 18);
  if (!name) return { name, error: 'Type a name first.' };
  if (existing.some((n) => n.toLowerCase() === name.toLowerCase())) return { name, error: `${name} is already playing.` };
  if (existing.length >= MAX_PLAYERS) return { name, error: `${MAX_PLAYERS} players is the most.` };
  return { name, error: '' };
}
