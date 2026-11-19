// Don't Say It as plain data plus pure transitions, so the game saves after every step and
// resumes exactly where it was after a reload. Scores are never stored: they are the sum of
// every card's mark, so fixing a mark on the turn summary fixes the score with it.
import type { TabooCard } from '../../lib/content';
import { cardId } from './cards';

export type TeamIndex = 0 | 1;
export type Phase = 'handoff' | 'turn' | 'summary' | 'scores' | 'win';
/** got +1 · buzz (a banned word was said) −1 · skip 0, or −1 with the skip rule · time: on screen when time ran out, 0. */
export type Mark = 'got' | 'skip' | 'buzz' | 'time';
export type EndMode = 'score' | 'rounds';

export interface Played { word: string; banned: string[]; mark: Mark; /** On screen when time ran out. */ late?: boolean }
export interface Turn { team: TeamIndex; cards: Played[] }

export interface Config {
  names: [string, string];
  /** Seconds per turn. */
  seconds: number;
  /** Play to a points target, or for a number of rounds (each team one turn per round). */
  mode: EndMode;
  goal: number;
  rounds: number;
  /** Skips cost a point. */
  skipCost: boolean;
  packIds: string[];
}

export interface Game extends Config {
  v: 1;
  starter: TeamIndex;
  active: TeamIndex;
  phase: Phase;
  /** Every turn so far, oldest first; the one being played or reviewed is last. */
  turns: Turn[];
  /** The card on screen during a turn. */
  card: TabooCard | null;
  /** ms left in the turn, saved every second so a reload resumes with the right time. */
  timeLeft: number;
  winner: TeamIndex | null;
  /** Cards dealt this game (by cardId), so none comes back before the game ends. */
  played: string[];
}

export const SECONDS = [45, 60, 90] as const;
const PHASES: Phase[] = ['handoff', 'turn', 'summary', 'scores', 'win'];
const MARKS: Mark[] = ['got', 'skip', 'buzz', 'time'];

export const other = (t: TeamIndex): TeamIndex => (t === 0 ? 1 : 0);

export function points(mark: Mark, skipCost: boolean): number {
  if (mark === 'got') return 1;
  if (mark === 'buzz') return -1;
  return mark === 'skip' && skipCost ? -1 : 0;
}

export const turnScore = (t: Turn, skipCost: boolean): number => t.cards.reduce((n, c) => n + points(c.mark, skipCost), 0);

/** Each team's score: the sum of every card marked so far, the turn in play included. */
export function scores(g: Game): [number, number] {
  const s: [number, number] = [0, 0];
  for (const t of g.turns) s[t.team] += turnScore(t, g.skipCost);
  return s;
}

/** Scores before the last turn: what the scoreboard shows until that turn has been reviewed. */
export function scoresBefore(g: Game): [number, number] {
  const s = scores(g);
  const last = g.turns.at(-1);
  if (last && g.phase !== 'handoff' && g.phase !== 'win') s[last.team] -= turnScore(last, g.skipCost);
  return s;
}

/** Rounds started: a round is one turn for each team. */
export const roundNo = (g: Game): number => Math.ceil(g.turns.length / 2);
const turnsOf = (g: Game, t: TeamIndex): number => g.turns.filter((x) => x.team === t).length;
/** True when both teams have had the same number of turns (and at least one each). */
export const pairDone = (g: Game): boolean => g.turns.length > 0 && turnsOf(g, 0) === turnsOf(g, 1);

/** The end condition is met (target reached, or every round played), whoever leads. */
function atEnd(g: Game, s: [number, number]): boolean {
  if (!pairDone(g)) return false;
  return g.mode === 'score' ? Math.max(...s) >= g.goal : turnsOf(g, 0) >= g.rounds;
}

/** The winner once a full round ends with the end condition met and no tie; otherwise null. */
export function winnerOf(g: Game): TeamIndex | null {
  const s = scores(g);
  if (!atEnd(g, s) || s[0] === s[1]) return null;
  return s[0] > s[1] ? 0 : 1;
}

/** The end condition is met but the teams are level, so both play one more turn. */
export function tiedAtEnd(g: Game): boolean {
  const s = scores(g);
  return atEnd(g, s) && s[0] === s[1];
}

export function newGame(cfg: Config, starter: TeamIndex = 0): Game {
  return {
    v: 1,
    names: [cfg.names[0], cfg.names[1]],
    seconds: cfg.seconds,
    mode: cfg.mode,
    goal: cfg.goal,
    rounds: cfg.rounds,
    skipCost: cfg.skipCost,
    packIds: cfg.packIds.slice(),
    starter,
    active: starter,
    phase: 'handoff',
    turns: [],
    card: null,
    timeLeft: cfg.seconds * 1000,
    winner: null,
    played: [],
  };
}

export const configOf = (g: Game): Config => ({
  names: [g.names[0], g.names[1]], seconds: g.seconds, mode: g.mode, goal: g.goal, rounds: g.rounds, skipCost: g.skipCost, packIds: g.packIds.slice(),
});

export function startTurn(g: Game, card: TabooCard): Game {
  if (g.phase !== 'handoff') return g;
  return {
    ...g, phase: 'turn', card, timeLeft: g.seconds * 1000,
    turns: [...g.turns, { team: g.active, cards: [] }], played: [...g.played, cardId(card)],
  };
}

function withLast(g: Game, cards: Played[]): Turn[] {
  return [...g.turns.slice(0, -1), { ...g.turns.at(-1)!, cards }];
}

/** Marks the card on screen and shows `next`; with no next card (packs used up) the turn ends. */
export function markCard(g: Game, mark: Exclude<Mark, 'time'>, next: TabooCard | undefined): Game {
  if (g.phase !== 'turn' || !g.card || g.turns.length === 0) return g;
  const turns = withLast(g, [...g.turns.at(-1)!.cards, { word: g.card.word, banned: g.card.banned, mark }]);
  if (!next) return { ...g, turns, card: null, phase: 'summary' };
  return { ...g, turns, card: next, played: [...g.played, cardId(next)] };
}

export const tick = (g: Game, ms: number): Game => (g.phase === 'turn' ? { ...g, timeLeft: Math.max(0, Math.round(ms)) } : g);

/** Time is up: the card on screen is listed as unfinished (0 points, fixable if it was got at the buzzer). */
export function timeUp(g: Game): Game {
  if (g.phase !== 'turn' || g.turns.length === 0) return g;
  const cards = g.turns.at(-1)!.cards;
  const turns = g.card ? withLast(g, [...cards, { word: g.card.word, banned: g.card.banned, mark: 'time', late: true }]) : g.turns;
  return { ...g, turns, card: null, timeLeft: 0, phase: 'summary' };
}

/** The mark a tap on the summary changes a card to. The last card can also go back to "time". */
export function nextMark(c: Played): Mark {
  const cycle: Mark[] = c.late ? ['time', 'got', 'buzz'] : ['got', 'skip', 'buzz'];
  return cycle[(cycle.indexOf(c.mark) + 1) % cycle.length];
}

export function fixMark(g: Game, i: number): Game {
  const last = g.turns.at(-1);
  if (g.phase !== 'summary' || !last || !last.cards[i]) return g;
  return { ...g, turns: withLast(g, last.cards.map((c, j) => (j === i ? { ...c, mark: nextMark(c) } : c))) };
}

/** Summary done: the game is won, or the scoreboard shows this turn's points. */
export function finishTurn(g: Game): Game {
  if (g.phase !== 'summary') return g;
  const winner = winnerOf(g);
  return winner === null ? { ...g, phase: 'scores' } : { ...g, phase: 'win', winner };
}

export function nextTurn(g: Game): Game {
  if (g.phase !== 'scores') return g;
  return { ...g, phase: 'handoff', active: other(g.active), timeLeft: g.seconds * 1000 };
}

export const rematch = (g: Game): Game => newGame(configOf(g), other(g.starter));

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const isIdx = (n: unknown): n is TeamIndex => n === 0 || n === 1;
const isStrs = (a: unknown): a is string[] => Array.isArray(a) && a.every((x) => typeof x === 'string');
const isCard = (c: unknown): c is TabooCard => !!c && typeof (c as TabooCard).word === 'string' && isStrs((c as TabooCard).banned);
const isTurn = (t: Turn): boolean => !!t && isIdx(t.team) && Array.isArray(t.cards)
  && t.cards.every((c) => isCard(c) && MARKS.includes(c.mark));

/** Accepts a saved game only if every field has the shape this version expects. */
export function restore(raw: unknown): Game | null {
  const g = raw as Game | null;
  if (!g || typeof g !== 'object' || g.v !== 1 || !PHASES.includes(g.phase)) return null;
  if (!isStrs(g.names) || g.names.length !== 2 || !isStrs(g.packIds) || !isStrs(g.played)) return null;
  if (!isNum(g.seconds) || g.seconds <= 0 || !isNum(g.goal) || g.goal < 1 || !isNum(g.rounds) || g.rounds < 1) return null;
  if ((g.mode !== 'score' && g.mode !== 'rounds') || typeof g.skipCost !== 'boolean') return null;
  if (!isIdx(g.starter) || !isIdx(g.active) || !isNum(g.timeLeft) || !Array.isArray(g.turns) || !g.turns.every(isTurn)) return null;
  if (g.winner !== null && !isIdx(g.winner)) return null;
  if (g.card !== null && !isCard(g.card)) return null;
  if (g.phase === 'turn' && (!g.card || g.turns.length === 0)) return null;
  if ((g.phase === 'summary' || g.phase === 'scores') && g.turns.length === 0) return null;
  if (g.phase === 'win' && g.winner === null) return null;
  return g;
}
