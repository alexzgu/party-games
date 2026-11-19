// The whole game as plain data plus pure transitions, so it saves to localStorage after
// every step and resumes exactly where it was after a reload.
import type { Spectrum } from '../../lib/content';
import { pointsFor, stealPoints, type Side } from './scoring';

export type TeamIndex = 0 | 1;
export type Phase = 'handoff' | 'reader' | 'team' | 'steal' | 'reveal' | 'win';

export interface Team { name: string; score: number }

export interface Round {
  card: Spectrum;
  target: number;
  redrawsLeft: number;
  clue: string;
  guess: number;
  call: Side | null;
  points: number;
  stealPoints: number;
  /** True once the reveal animation has played, so a reload does not replay it. */
  revealed: boolean;
}

export interface Config { names: [string, string]; goal: number; steal: boolean; packIds: string[] }

export interface Game {
  v: 1;
  teams: [Team, Team];
  goal: number;
  steal: boolean;
  packIds: string[];
  active: TeamIndex;
  starter: TeamIndex;
  phase: Phase;
  round: Round | null;
  roundNo: number;
  winner: TeamIndex | null;
  /** Cards dealt this game (by cardId), so none comes back before the game ends. */
  played: string[];
}

const PHASES: Phase[] = ['handoff', 'reader', 'team', 'steal', 'reveal', 'win'];

export const other = (t: TeamIndex): TeamIndex => (t === 0 ? 1 : 0);

export const cardId = (c: Spectrum): string => (c.left + '|' + c.right).trim().toLowerCase();

export function newGame(cfg: Config, starter: TeamIndex = 0): Game {
  return {
    v: 1,
    teams: [{ name: cfg.names[0], score: 0 }, { name: cfg.names[1], score: 0 }],
    goal: cfg.goal,
    steal: cfg.steal,
    packIds: cfg.packIds.slice(),
    active: starter,
    starter,
    phase: 'handoff',
    round: null,
    roundNo: 0,
    winner: null,
    played: [],
  };
}

export function beginRound(g: Game, card: Spectrum, target: number): Game {
  const round: Round = { card, target, redrawsLeft: 1, clue: '', guess: 50, call: null, points: 0, stealPoints: 0, revealed: false };
  return { ...g, phase: 'reader', round, roundNo: g.roundNo + 1, played: [...g.played, cardId(card)] };
}

function withRound(g: Game, patch: Partial<Round>): Game {
  return g.round ? { ...g, round: { ...g.round, ...patch } } : g;
}

export function redraw(g: Game, card: Spectrum): Game {
  if (!g.round || g.round.redrawsLeft <= 0) return g;
  const next = withRound(g, { card, redrawsLeft: g.round.redrawsLeft - 1 });
  return { ...next, played: [...g.played, cardId(card)] };
}

export const setClue = (g: Game, clue: string): Game => withRound(g, { clue });
export const showTeam = (g: Game): Game => ({ ...g, phase: 'team' });
export const setGuess = (g: Game, guess: number): Game => withRound(g, { guess });

/** Scores are applied the moment the result is final; the reveal only animates them. */
function score(g: Game, call: Side | null): Game {
  const r = g.round!;
  const points = pointsFor(r.target, r.guess);
  const steal = g.steal ? stealPoints(r.target, r.guess, call) : 0;
  const teams = g.teams.map((t) => ({ ...t })) as [Team, Team];
  teams[g.active].score += points;
  teams[other(g.active)].score += steal;
  return { ...g, teams, phase: 'reveal', round: { ...r, call, points, stealPoints: steal } };
}

export function lockIn(g: Game, guess: number): Game {
  if (g.phase !== 'team' || !g.round) return g;
  const next = setGuess(g, guess);
  return g.steal ? { ...next, phase: 'steal' } : score(next, null);
}

export function callSide(g: Game, side: Side): Game {
  return g.phase === 'steal' && g.round ? score(g, side) : g;
}

export const markRevealed = (g: Game): Game => withRound(g, { revealed: true });

/** Scores as they stood before this round's points, for the count-up at the reveal. */
export function scoresBefore(g: Game): [number, number] {
  const s: [number, number] = [g.teams[0].score, g.teams[1].score];
  if (g.phase === 'reveal' && g.round && !g.round.revealed) {
    s[g.active] -= g.round.points;
    s[other(g.active)] -= g.round.stealPoints;
  }
  return s;
}

/** A team wins on reaching the goal with more points than the other; a tie plays on. */
export function winnerOf(teams: [Team, Team], goal: number): TeamIndex | null {
  const [a, b] = [teams[0].score, teams[1].score];
  if (Math.max(a, b) < goal || a === b) return null;
  return a > b ? 0 : 1;
}

export function nextTurn(g: Game): Game {
  const winner = winnerOf(g.teams, g.goal);
  if (winner !== null) return { ...g, phase: 'win', winner };
  return { ...g, phase: 'handoff', active: other(g.active), round: null };
}

export function rematch(g: Game): Game {
  const starter = other(g.starter);
  return newGame({ names: [g.teams[0].name, g.teams[1].name], goal: g.goal, steal: g.steal, packIds: g.packIds }, starter);
}

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const inDial = (n: unknown) => isNum(n) && n >= 0 && n <= 100;
const isIdx = (n: unknown) => n === 0 || n === 1;
const isStrs = (a: unknown) => Array.isArray(a) && a.every((x) => typeof x === 'string');

function validTeam(t: Team | undefined): boolean {
  return !!t && typeof t.name === 'string' && isNum(t.score);
}

function validRound(r: Round | null | undefined): boolean {
  return !!r && !!r.card && typeof r.card.left === 'string' && typeof r.card.right === 'string'
    && inDial(r.target) && inDial(r.guess) && isNum(r.redrawsLeft) && typeof r.clue === 'string'
    && (r.call === null || r.call === 'left' || r.call === 'right')
    && isNum(r.points) && isNum(r.stealPoints) && typeof r.revealed === 'boolean';
}

/** Accepts a saved game only if every field has the shape this version expects. */
export function restore(raw: unknown): Game | null {
  const g = raw as Game | null;
  if (!g || typeof g !== 'object' || g.v !== 1 || !PHASES.includes(g.phase)) return null;
  if (!Array.isArray(g.teams) || g.teams.length !== 2 || !g.teams.every(validTeam)) return null;
  if (!isNum(g.goal) || g.goal < 1 || typeof g.steal !== 'boolean' || !isStrs(g.packIds) || !isStrs(g.played)) return null;
  if (!isIdx(g.active) || !isIdx(g.starter) || !isNum(g.roundNo) || g.roundNo < 0) return null;
  if (g.winner !== null && !isIdx(g.winner)) return null;
  if (g.phase === 'win' ? g.winner === null : g.phase !== 'handoff' && !validRound(g.round)) return null;
  return g;
}
