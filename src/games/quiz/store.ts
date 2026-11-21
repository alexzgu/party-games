// What Big Board remembers on this phone: the game in progress, the last setup, and a board being
// made that has not been saved yet. Everything goes through the guarded storage helpers.
import { load, remove, save } from '../../lib/storage';
import { customQuiz, isBuiltin, slugify, type QuizBoard } from '../../lib/content';
import { MAX_TEAMS, MIN_TEAMS, validGame, type Game } from './logic';
import { DEFAULT_TEAMS } from './look';
import { sizeProblem } from './board';

const GAME = 'quiz:game';
const SETUP = 'quiz:setup';
const NEW_BOARD = 'quiz:new-board';

export const loadGame = (): Game | null => validGame(load<unknown>(GAME, null));
export const saveGame = (g: Game | null): void => (g ? save(GAME, g) : remove(GAME));

export interface SetupPrefs {
  /** Names for every seat; the first `count` play. */
  names: string[];
  count: number;
  boardId: string | null;
  double: boolean;
  penalty: boolean;
}

export const DEFAULT_SETUP: SetupPrefs = { names: DEFAULT_TEAMS, count: 3, boardId: null, double: false, penalty: false };

/**
 * Saved setup choices, each field checked on its own and replaced by its default if bad. A setup
 * saved with fewer seats gets default names for the rest; one saved with more keeps the first ten.
 */
export function validSetup(x: unknown): SetupPrefs {
  const p = (x && typeof x === 'object' ? x : {}) as Partial<SetupPrefs>;
  const names = DEFAULT_TEAMS.map((d, i) => (Array.isArray(p.names) && typeof p.names[i] === 'string' ? p.names[i] : d));
  const count = Number.isInteger(p.count) && p.count! >= MIN_TEAMS && p.count! <= MAX_TEAMS ? p.count! : DEFAULT_SETUP.count;
  return {
    names,
    count,
    boardId: typeof p.boardId === 'string' ? p.boardId : null,
    double: p.double === true,
    penalty: p.penalty === true,
  };
}

export const loadSetup = (): SetupPrefs => validSetup(load<unknown>(SETUP, null));
export const saveSetup = (p: SetupPrefs): void => save(SETUP, p);

// ---- A board made with "Make a board" (blank, pasted or from Claude) waits here, so a reload
// keeps it, until the host saves it from the editor or throws it away.

function validNewBoard(x: unknown): QuizBoard | null {
  const b = x as QuizBoard | null;
  const ok = !!b && typeof b.name === 'string' && typeof b.blurb === 'string' && Array.isArray(b.categories)
    && b.categories.every((c) => typeof c?.name === 'string' && Array.isArray(c.clues) && c.clues.every((k) => typeof k?.clue === 'string' && typeof k?.answer === 'string'));
  return ok && !sizeProblem(b) ? b : null;
}

/**
 * The board waiting to be saved. It keeps its share mark (`shared`, set by `afterRun` in
 * src/lib/library.ts when Fizzwick wrote it through a magic-words pass), and saving keeps it on
 * the saved board, so a board written with the host's own key stays private for good.
 */
export const loadNewBoard = (): QuizBoard | null => validNewBoard(load<unknown>(NEW_BOARD, null));
export const saveNewBoard = (b: QuizBoard | null): void => (b ? save(NEW_BOARD, b) : remove(NEW_BOARD));

/** A fresh id for a board saved on this phone: its name as a slug, never a built-in's or another own board's. */
export function newBoardId(name: string): string {
  let base = slugify(name);
  if (isBuiltin(base, 'quiz')) base = 'my-' + base;
  const taken = new Set(customQuiz.all().map((b) => b.id));
  let id = base;
  for (let n = 2; taken.has(id) || isBuiltin(id, 'quiz'); n++) id = `${base}-${n}`;
  return id;
}

/** Remembers a board as the one picked on setup, so a board just made or edited is ready to play. */
export function pickBoard(id: string): void {
  saveSetup({ ...loadSetup(), boardId: id });
}
