// Pure rules for Big Board: every step takes a state and returns the next one, so the screens
// stay thin and each step can be saved and unit-tested. Scores are never stored: they are the
// sum of the log (plus wrong marks on the clue that is open), so undo is just "drop the last entry".
import type { HistoryEntry } from '../../lib/history';
import type { Reseat } from '../../lib/players';
import type { QuizBoard, QuizCategory } from '../../lib/content';
import { emptyTiles, sizeProblem } from './board';

/** One team is a solo player; 20 fills a big room. */
export const MIN_TEAMS = 1;
export const MAX_TEAMS = 10;
/** Games saved when up to 20 teams were allowed still load as they were. */
const SAVED_MAX_TEAMS = 20;
export const BASE_STEP = 100;

/** board: tiles · clue: host reads the clue · answer: answer shown, host picks who got it · win: game over */
export type Phase = 'board' | 'clue' | 'answer' | 'win';

/** A tile closed by the host (`winner` -1 for nobody), or a score fixed by hand. */
export type LogEntry =
  | { kind: 'tile'; tile: number; winner: number; wrong: number[] }
  | { kind: 'adjust'; team: number; delta: number };

export interface Game {
  v: 1;
  teams: string[];
  /** A copy of the board as it was when the game started, so a later edit never breaks a resume. */
  board: { id: string; name: string; categories: QuizCategory[] };
  /** Points per row, top (easiest) to bottom. */
  values: number[];
  /** Wrong answers cost the tile's value. */
  penalty: boolean;
  phase: Phase;
  /** The tile on screen and the teams marked wrong on it so far. */
  open: { tile: number; wrong: number[] } | null;
  log: LogEntry[];
  /** True when the host ended the game before the board was cleared. */
  ended: boolean;
}

export interface Options { teams: string[]; board: QuizBoard; double: boolean; penalty: boolean }

/** Row values for a board with `rows` clues per category: 100, 200, … or doubled. */
export const rowValues = (rows: number, double: boolean): number[] =>
  Array.from({ length: rows }, (_, r) => (r + 1) * BASE_STEP * (double ? 2 : 1));

/** A board that cannot be played yet: wrong size or empty tiles. Setup never offers to start one. */
export function newGame(o: Options): Game {
  if (o.teams.length < MIN_TEAMS || o.teams.length > MAX_TEAMS) throw new Error(`Need ${MIN_TEAMS}–${MAX_TEAMS} teams`);
  const bad = sizeProblem(o.board) || (emptyTiles(o.board).length ? 'it has empty tiles' : '');
  if (bad) throw new Error(`Board "${o.board.name}" cannot be played: ${bad}`);
  const rows = o.board.categories[0]?.clues.length ?? 0;
  return {
    v: 1,
    teams: o.teams.slice(),
    board: { id: o.board.id, name: o.board.name, categories: o.board.categories.map((c) => ({ name: c.name, clues: c.clues.map((k) => ({ ...k })) })) },
    values: rowValues(rows, o.double),
    penalty: o.penalty,
    phase: 'board',
    open: null,
    log: [],
    ended: false,
  };
}

/** One team: a solo player going for a high score, with "Got it / Missed" instead of a contest. */
export const solo = (g: Game) => g.teams.length === 1;

// Tiles are numbered column by column: category c, row r → c * rows + r.
export const rows = (g: Game) => g.values.length;
export const tileCount = (g: Game) => g.board.categories.length * rows(g);
export const tileAt = (g: Game, c: number, r: number) => c * rows(g) + r;
export const tileValue = (g: Game, tile: number) => g.values[tile % rows(g)];
export function tileInfo(g: Game, tile: number) {
  const cat = g.board.categories[Math.floor(tile / rows(g))];
  return { category: cat.name, value: tileValue(g, tile), ...cat.clues[tile % rows(g)] };
}

export const usedTiles = (g: Game): Set<number> =>
  new Set(g.log.flatMap((e) => (e.kind === 'tile' ? [e.tile] : [])));
export const boardCleared = (g: Game) => usedTiles(g).size >= tileCount(g);

/** Every team's score: closed tiles, hand fixes, and wrong marks on the tile still open. */
export function scores(g: Game): number[] {
  const s = g.teams.map(() => 0);
  for (const e of g.log) {
    if (e.kind === 'adjust') s[e.team] += e.delta;
    else {
      const v = tileValue(g, e.tile);
      if (e.winner >= 0) s[e.winner] += v;
      if (g.penalty) for (const t of e.wrong) s[t] -= v;
    }
  }
  if (g.open && g.penalty) for (const t of g.open.wrong) s[t] -= tileValue(g, g.open.tile);
  return s;
}

/** Host taps a tile on the board. Used tiles and taps outside the board do nothing. */
export function openTile(g: Game, tile: number): Game {
  if (g.phase !== 'board' || tile < 0 || tile >= tileCount(g) || usedTiles(g).has(tile)) return g;
  return { ...g, phase: 'clue', open: { tile, wrong: [] } };
}

/** Back to the board without using the tile: it stays playable and any wrong marks are dropped. */
export function closeTile(g: Game): Game {
  if (g.phase !== 'clue' && g.phase !== 'answer') return g;
  return { ...g, phase: 'board', open: null };
}

export function showAnswer(g: Game): Game {
  return g.phase === 'clue' ? { ...g, phase: 'answer' } : g;
}

/**
 * Marks a team wrong on the open tile, or takes the mark back. Only with the penalty rule on and
 * two or more teams: a solo player's wrong answer is their "Missed" (see award).
 */
export function toggleWrong(g: Game, team: number): Game {
  if (!g.open || !g.penalty || solo(g) || (g.phase !== 'clue' && g.phase !== 'answer') || !g.teams[team]) return g;
  const wrong = g.open.wrong.includes(team) ? g.open.wrong.filter((t) => t !== team) : [...g.open.wrong, team].sort((a, b) => a - b);
  return { ...g, open: { ...g.open, wrong } };
}

/**
 * The host taps the team that got it (or -1, nobody): the tile is used and play returns to the board.
 * Solo, -1 is "Missed": with the penalty rule on it costs the player the tile's value.
 */
export function award(g: Game, winner: number): Game {
  if (g.phase !== 'answer' || !g.open) return g;
  if (winner !== -1 && (!g.teams[winner] || g.open.wrong.includes(winner))) return g;
  const wrong = solo(g) ? (winner === -1 && g.penalty ? [0] : []) : g.open.wrong;
  const entry: LogEntry = { kind: 'tile', tile: g.open.tile, winner, wrong };
  return { ...g, phase: 'board', open: null, log: [...g.log, entry] };
}

/** A score fixed by hand from the score strip, at any point of play. */
export function adjust(g: Game, team: number, delta: number): Game {
  if (g.phase === 'win' || !g.teams[team] || !Number.isFinite(delta) || delta === 0) return g;
  return { ...g, log: [...g.log, { kind: 'adjust', team, delta }] };
}

/**
 * Takes back the last scoring. A hand fix is simply dropped; a closed tile reopens on its answer
 * with its wrong marks, so the host can tap the right team.
 */
export function undo(g: Game): Game {
  const last = g.log.at(-1);
  if (g.phase !== 'board' || !last) return g;
  const log = g.log.slice(0, -1);
  if (last.kind === 'adjust') return { ...g, log };
  // Solo, a wrong mark only ever comes from "Missed", so the reopened tile starts clean.
  return { ...g, log, phase: 'answer', open: { tile: last.tile, wrong: solo(g) ? [] : last.wrong } };
}

/** What Undo would take back, in a few words, or '' when there is nothing to undo. */
export function undoLabel(g: Game): string {
  const last = g.log.at(-1);
  if (!last) return '';
  if (last.kind === 'adjust') return `${g.teams[last.team]} ${signed(last.delta)}`;
  const { category, value } = tileInfo(g, last.tile);
  return `${category} ${value}: ${outcome(g, last.winner)}`;
}

export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');
/** A score as shown: 1200, −300. */
export const points = (n: number) => (n < 0 ? `−${(-n).toLocaleString('en-US')}` : n.toLocaleString('en-US'));

/** True once any team's score has moved, so ending the game is worth a History entry. */
export function anyScored(g: Game): boolean {
  return scores(g).some((s) => s !== 0) || g.log.some((e) => (e.kind === 'tile' ? e.winner >= 0 || (g.penalty && e.wrong.length > 0) : e.delta !== 0));
}

/**
 * The saved game with the teams edited in setup (`r` from `reseating`): a kept team keeps its
 * points under its new name and place, added teams start at 0, and a removed team leaves with its
 * points (tiles it won count as nobody's, its wrong marks and score fixes go). Solo and team play
 * do not turn into each other mid-game.
 */
export function reseat(g: Game, r: Reseat): Game {
  const n = r.names.length;
  if (n < MIN_TEAMS || n > MAX_TEAMS || (n === 1) !== solo(g)) return g;
  const to = (t: number) => r.places[t] ?? -1;
  const kept = (wrong: number[]) => wrong.map(to).filter((t) => t >= 0).sort((a, b) => a - b);
  const log = g.log.flatMap((e): LogEntry[] =>
    e.kind === 'adjust' ? (to(e.team) >= 0 ? [{ ...e, team: to(e.team) }] : [])
    : [{ ...e, winner: e.winner >= 0 ? to(e.winner) : -1, wrong: kept(e.wrong) }]);
  const open = g.open && { ...g.open, wrong: kept(g.open.wrong) };
  return { ...g, teams: r.names.slice(), log, open };
}

/** Game over: the board is cleared, or the host ended it (`early`). */
export function finish(g: Game, early: boolean): Game {
  if (g.phase === 'win') return g;
  return { ...g, phase: 'win', open: null, ended: early };
}

/** Same teams and settings on the same board, scores back to zero. */
export function rematch(g: Game): Game {
  return { ...g, phase: 'board', open: null, log: [], ended: false };
}

/** Teams best first, ties in seating order. */
export function standings(g: Game): { name: string; score: number; index: number }[] {
  const s = scores(g);
  return g.teams.map((name, index) => ({ name, score: s[index], index })).sort((a, b) => b.score - a.score || a.index - b.index);
}

/** The teams sharing the top score, or none when nobody has scored anything. */
export function leaders(g: Game): number[] {
  const rows = standings(g);
  const best = rows[0]?.score ?? 0;
  if (rows.every((r) => r.score === 0)) return [];
  return rows.filter((r) => r.score === best).map((r) => r.index);
}

export type Summary = Omit<HistoryEntry, 'id' | 'at'>;

/** Who a closed tile went to, in words: a team, "nobody", or solo "got it" / "missed". */
const outcome = (g: Game, winner: number) => (solo(g) ? (winner >= 0 ? 'got it' : 'missed') : winner >= 0 ? g.teams[winner] : 'nobody');

/** The History entry for a game reaching the win screen ("Brainiacs won 1,500–900–200"). */
export function gameRecord(g: Game): Summary {
  return entry(g, g.ended ? 'led' : 'won', !g.ended);
}

/**
 * The entry for a game thrown away before its win screen (starting over on top of it), or null
 * when nothing was scored or the game already reached its win screen (recorded there).
 */
export function endedRecord(g: Game): Summary | null {
  if (g.phase === 'win' || !anyScored(g)) return null;
  if (boardCleared(g)) return entry(g, 'won', true);
  return entry(g, 'led', false);
}

/** Teams whose scores all fit in a History title; more get the top score and a head count. */
const TITLE_TEAMS = 4;

function entry(g: Game, verb: 'won' | 'led', finished: boolean): Summary {
  const rows = standings(g);
  const top = leaders(g).map((i) => g.teams[i]);
  const line = rows.length > TITLE_TEAMS ? `${points(rows[0].score)} · ${rows.length} teams` : rows.map((r) => points(r.score)).join('–');
  const head = top.length === 0 ? 'Nobody scored' : top.length === 1 ? `${top[0]} ${verb}` : top.length > 3 ? `${top.length} teams tied` : `${listed(top)} tied`;
  return {
    game: 'quiz',
    title: solo(g) ? `${g.teams[0]} scored ${points(rows[0].score)}` : `${head} ${line}`,
    scores: rows.map((r) => ({ name: r.name, score: r.score })),
    packs: [g.board.name],
    details: g.log.map((e) => detail(g, e)),
    finished,
  };
}

/** "A and B", "A, B and C". */
const listed = (names: string[]) => (names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

function detail(g: Game, e: LogEntry): string {
  if (e.kind === 'adjust') return `Score fix: ${g.teams[e.team]} ${signed(e.delta)}`;
  const t = tileInfo(g, e.tile);
  const wrong = g.penalty && e.wrong.length ? ` (wrong: ${e.wrong.map((i) => g.teams[i]).join(', ')})` : '';
  return `${t.category} ${t.value} · ${t.answer}: ${outcome(g, e.winner)}${solo(g) ? '' : wrong}`;
}

// ---- Saved state: everything a screen reads is checked, so a damaged save falls back to setup.
// Saves from before 1–20 teams (2–4 teams, 3–6 × 3–5 boards) have the same shape and load as they are.

const isInt = (x: unknown, min: number, max: number): x is number => Number.isInteger(x) && (x as number) >= min && (x as number) <= max;
const str = (x: unknown): x is string => typeof x === 'string';
const teamList = (x: unknown, n: number): x is number[] => Array.isArray(x) && x.every((t) => isInt(t, 0, n - 1));

function validBoard(b: unknown): b is Game['board'] {
  const x = b as Game['board'] | null;
  if (!x || !str(x.id) || !str(x.name) || !Array.isArray(x.categories) || x.categories.length === 0) return false;
  const len = x.categories[0]?.clues?.length;
  return x.categories.every((c) => str(c?.name) && Array.isArray(c.clues) && c.clues.length === len && c.clues.every((k) => str(k?.clue) && str(k?.answer)));
}

export function validGame(x: unknown): Game | null {
  const g = x as Game | null;
  if (!g || typeof g !== 'object' || g.v !== 1) return null;
  if (!Array.isArray(g.teams) || g.teams.length < MIN_TEAMS || g.teams.length > SAVED_MAX_TEAMS || !g.teams.every(str)) return null;
  if (!validBoard(g.board)) return null;
  const n = g.board.categories[0].clues.length;
  if (!Array.isArray(g.values) || g.values.length !== n || !g.values.every((v) => Number.isFinite(v))) return null;
  if (!['board', 'clue', 'answer', 'win'].includes(g.phase)) return null;
  const tiles = g.board.categories.length * n;
  const teams = g.teams.length;
  if (!Array.isArray(g.log)) return null;
  const okEntry = (e: LogEntry) =>
    e?.kind === 'tile' ? isInt(e.tile, 0, tiles - 1) && isInt(e.winner, -1, teams - 1) && teamList(e.wrong, teams)
    : e?.kind === 'adjust' ? isInt(e.team, 0, teams - 1) && Number.isFinite(e.delta)
    : false;
  if (!g.log.every(okEntry)) return null;
  const open = g.open;
  if (g.phase === 'clue' || g.phase === 'answer') {
    if (!open || !isInt(open.tile, 0, tiles - 1) || !teamList(open.wrong, teams)) return null;
  }
  return { ...g, penalty: !!g.penalty, ended: !!g.ended, open: g.phase === 'clue' || g.phase === 'answer' ? open : null };
}
