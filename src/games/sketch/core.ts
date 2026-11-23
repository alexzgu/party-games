// Sketchy's game state and the small helpers both modes share. The modes' rules live in
// telephone.ts and guess.ts; joining, leaving and the clock in logic.ts.
export type Mode = 'telephone' | 'guess';
export const WRITE_TIMES = [30, 45, 60] as const;
export const DRAW_TIMES = [60, 90, 120, 180] as const;
export const ROUND_CHOICES = [1, 2, 3, 4] as const;
export const GUESS_TIMES = [60, 80, 120] as const;
/** Characters in a player's name, at most. */
export const NAME_MAX = 20;
export const MAX_PLAYERS = 10;
/** Characters in a Telephone line, at most. */
export const LINE_MAX = 80;
/** Characters in a guess, at most. */
export const GUESS_MAX = 40;
/** A phone sends what it has when a step's timer ends: the host waits this long for it to arrive. */
export const DELIVERY_MS = 1000;
/** After the host reopens or changes broker, phones get this long to reconnect (*house*). */
export const RECONNECT_GRACE_MS = 10000;

export type Settings = {
  mode: Mode; packs: string[];
  /** Telephone: seconds to write a line (step 1 and every describe step) and to draw. */
  writeSecs: number; drawSecs: number;
  /** Draw & guess: rounds and seconds to draw. */
  rounds: number; guessSecs: number;
};
export const DEFAULT_SETTINGS: Settings = { mode: 'telephone', packs: ['classic'], writeSecs: 45, drawSecs: 90, rounds: 2, guessSecs: 80 };

export type Phase = 'lobby' | 'write' | 'draw' | 'describe' | 'album' | 'pick' | 'guess' | 'reveal' | 'scores' | 'over';
export type Player = { pid: string; name: string; score: number };

/** One step of a Telephone chain: a line (`filled` when the game wrote it) or a drawing (`id` null when blank). */
export type Entry = { kind: 'text'; text: string; by: string; filled?: boolean } | { kind: 'drawing'; id: string | null; by: string };
export type Telephone = {
  /** Who plays, in seat order at the start; `square[step][i]` is the chain `order[i]` works on. */
  order: string[]; square: number[][]; step: number;
  /** `chains[chain][step]`, null until done. */
  chains: (Entry | null)[][];
  /** Shuffled ideas the game fills empty lines with. */
  ideas: string[];
  /** The album page: which chain and which of its entries is shown. */
  page: { chain: number; entry: number };
};

export type Feed = { pid: string; name: string; text?: string; got?: boolean };
export type Guessing = {
  round: number; order: string[]; turn: number; drawer: string;
  /** Words not yet offered, shuffled; each offer takes three from the front. */
  pool: string[]; offer: string[]; word: string;
  /** Letter places the hints show, in order; `shown` of them are shown now. */
  hints: number[]; shown: number;
  /** Who got it this turn, in order, and what each earned. */
  got: { pid: string; points: number }[];
  feed: Feed[];
  /** A guesser's last guess that was one letter off, told only to them. */
  close: Record<string, string>;
  /** When the drawer went offline (ms), or null. */
  away: number | null;
  /** The last turn's points, by player, for the reveal. */
  points: { pid: string; points: number }[];
};

export type Game = {
  id: string; code: string; settings: Settings; phase: Phase; at: number;
  players: Player[]; kicked: string[];
  /** Players out by their own choice ("Leave room"), among `kicked` until they come back. */
  left?: string[];
  deadline: number | null; frozen: number | null;
  /** Total ms on the current timer, for the ring. */
  total: number;
  tel?: Telephone; dg?: Guessing;
  /** Until then (ms) phones are still reconnecting to a host that just reopened or changed broker:
   * nobody counts as away and "everyone present is done" ends nothing. */
  grace?: number;
};

export const newGame = (id: string, code: string, settings: Settings): Game => ({
  id, code, settings, phase: 'lobby', at: 0, players: [], kicked: [], deadline: null, frozen: null, total: 0,
});

export const active = (g: Game) => g.players.filter((p) => !g.kicked.includes(p.pid));
export const isActive = (g: Game, pid: string) => g.players.some((p) => p.pid === pid) && !g.kicked.includes(pid);
export const standings = (g: Game) => [...g.players].sort((a, b) => b.score - a.score);
export const left = (g: Game, now: number) => g.frozen ?? (g.deadline === null ? null : Math.max(0, g.deadline - now));
/** Phones may still be reconnecting (see `Game.grace`). */
export const settling = (g: Game, now: number) => g.grace !== undefined && now < g.grace;
/** In the room and online now. */
export const present = (g: Game, online: ReadonlySet<string>) => active(g).filter((p) => online.has(p.pid));
export const nameOf = (g: Game, pid: string) => g.players.find((p) => p.pid === pid)?.name ?? 'Someone';

export function enter(g: Game, phase: Phase, now: number, seconds?: number): Game {
  return { ...g, phase, at: g.at + 1, deadline: seconds === undefined ? null : now + seconds * 1000, frozen: null, total: (seconds ?? 0) * 1000 };
}

/** The first `n` items of a list, and the rest. */
export const take = <T>(items: T[], n: number): [T[], T[]] => [items.slice(0, n), items.slice(n)];
