// Smarty Pants's game state on the host, and the small reads every other module shares.

export const NAME_MAX = 20;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 12;
/** Questions in one game. */
export const COUNTS = [10, 15, 20] as const;
/** Seconds to answer. */
export const ANSWER_TIMES = [10, 15, 20, 30] as const;
/** The category alone on screen before its question. */
export const CATEGORY_MS = 3000;
export const REVEAL_MS = 8000;
/** A right answer's points, plus up to as many again for speed (*house*). */
export const RIGHT_POINTS = 500;
export const SPEED_POINTS = 500;
/** After the host screen opens or changes broker, how long phones get to reconnect before anyone counts as gone (*house*). */
export const RECONNECT_MS = 10_000;
/** After the host screen reloads, a timer that ran out meanwhile gets this much extra time (*house*). */
export const EXTRA_MS = 12_000;

export type Settings = { count: number; seconds: number; packs: string[] };
export const DEFAULT_SETTINGS: Settings = { count: 10, seconds: 20, packs: ['classic'] };

export type Phase = 'lobby' | 'category' | 'answer' | 'reveal' | 'over';
/** One of the four answers, in the order shown. */
export type Choice = 0 | 1 | 2 | 3;
export const CHOICES: readonly Choice[] = [0, 1, 2, 3];
export type Player = { pid: string; name: string; score: number };
/** A question as the game asks it: its four answers in the order shown (shuffled once) and which is right. */
export type Asked = { category: string; question: string; answers: [string, string, string, string]; right: Choice };
/** A player's one answer: the choice, and the timer's ms left when the host received it. */
export type Answer = { choice: Choice; left: number };
/** The reveal: how many picked each answer, and who was right with the points each gained (most first, then seat order). */
export type Result = { counts: [number, number, number, number]; gains: { pid: string; points: number }[] };
export type Round = {
  /** The question's number in this game, from 1. */
  n: number; q: Asked;
  /** Each player's first answer; only those still in the game at the reveal count. */
  answers: Record<string, Answer>;
  result: Result | null;
};
/** A question already revealed, for History: how many of how many answered right. */
export type Past = { category: string; question: string; right: string; correct: number; of: number };
export type Game = {
  id: string; code: string; settings: Settings; phase: Phase; at: number;
  deadline: number | null;
  /** When the host paused (null: running), and the timer's ms left then (null: no timer). */
  paused: number | null; frozen: number | null;
  /**
   * The phase's timer ran out while the host screen was reloading and was given `EXTRA_MS` more
   * (`afterReload`), so phones can reconnect and answer: an answer then scores no speed points.
   * Cleared when the phase changes.
   */
  extra: boolean;
  /** Until then phones are still reconnecting (host reload, broker change): nobody counts as gone. */
  quiet: number | null;
  players: Player[]; kicked: string[];
  /** Players out by their own choice ("Leave room"), among `kicked` until they come back. */
  left: string[];
  /** This game's questions, in the order asked. */
  questions: Asked[];
  round: Round | null; results: Past[];
  /** The keys (`triviaKey`) of the questions this room has asked, never their text: the next game asks others while the picks have them. */
  asked: string[];
};

export const newGame = (id: string, code: string, settings: Settings): Game => ({
  id, code, settings, phase: 'lobby', at: 0, deadline: null, paused: null, frozen: null, quiet: null, extra: false,
  players: [], kicked: [], left: [], questions: [], round: null, results: [], asked: [],
});

export const active = (g: Game) => g.players.filter((p) => !g.kicked.includes(p.pid));
export const isActive = (g: Game, pid: string) => g.players.some((p) => p.pid === pid) && !g.kicked.includes(pid);
export const standings = (g: Game) => [...active(g)].sort((a, b) => b.score - a.score);
export const left = (g: Game, now: number) => g.paused !== null ? g.frozen : g.deadline === null ? null : Math.max(0, g.deadline - now);
export const reconnecting = (g: Game, now: number) => g.quiet !== null && now < g.quiet;
export const canStart = (g: Game) => g.phase === 'lobby' && active(g).length >= MIN_PLAYERS;
/** How long a phase's timer runs, in ms (0: none). */
export const phaseMs = (phase: Phase, s: Settings) => phase === 'category' ? CATEGORY_MS : phase === 'answer' ? s.seconds * 1000 : phase === 'reveal' ? REVEAL_MS : 0;

export function enter(g: Game, phase: Phase, now: number): Game {
  const ms = phaseMs(phase, g.settings);
  return { ...g, phase, at: g.at + 1, deadline: ms ? now + ms : null, paused: null, frozen: null, extra: false };
}

/** Stops the clock in any phase of play. */
export const pause = (g: Game, now: number): Game =>
  g.paused !== null || g.phase === 'lobby' || g.phase === 'over' ? g : { ...g, paused: now, frozen: left(g, now) };

export const resume = (g: Game, now: number): Game =>
  g.paused === null ? g : { ...g, paused: null, frozen: null, deadline: g.frozen !== null ? now + g.frozen : g.deadline };

/** Phones get a moment to find the room again before anyone counts as gone. */
export const quiet = (g: Game, now: number): Game => ({ ...g, quiet: now + RECONNECT_MS });

/** After the host screen reloads: a timer that ran out meanwhile gets `EXTRA_MS` more (marked `extra`), and phones get time to reconnect. */
export function afterReload(g: Game, now: number): Game {
  const ranOut = g.paused === null && g.deadline !== null && g.deadline <= now;
  return quiet(ranOut ? { ...g, deadline: now + EXTRA_MS, extra: true } : g, now);
}
