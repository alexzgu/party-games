// What Big Board remembers on this phone: the game in progress and the last setup.
// Everything goes through the guarded storage helpers.
import { load, remove, save } from '../../lib/storage';
import { MAX_TEAMS, MIN_TEAMS, validGame, type Game } from './logic';
import { DEFAULT_TEAMS } from './look';

const GAME = 'quiz:game';
const SETUP = 'quiz:setup';

export const loadGame = (): Game | null => validGame(load<unknown>(GAME, null));
export const saveGame = (g: Game | null): void => (g ? save(GAME, g) : remove(GAME));

export interface SetupPrefs {
  /** Names for all four seats; the first `count` play. */
  names: string[];
  count: number;
  boardId: string | null;
  double: boolean;
  penalty: boolean;
}

export const DEFAULT_SETUP: SetupPrefs = { names: DEFAULT_TEAMS, count: 3, boardId: null, double: false, penalty: false };

/** Saved setup choices, each field checked on its own and replaced by its default if bad. */
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
