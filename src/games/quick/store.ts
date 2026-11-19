// What Brain Freeze remembers on this phone: the game in progress, the player list and the
// last setup. Everything goes through the guarded storage helpers.
import { load, remove, save } from '../../lib/storage';
import { validGame, validSetup, type GameState, type SetupPrefs } from './logic';

const GAME = 'quick:game';
const PLAYERS = 'quick:players';
const SETUP = 'quick:setup';
/** Inn Co Hear Ant's player list: the same friends, so a first game here starts with them. */
const OTHER_PLAYERS = 'gibberish:players';

export const loadGame = (): GameState | null => validGame(load<unknown>(GAME, null));
export const saveGame = (s: GameState | null) => (s ? save(GAME, s) : remove(GAME));

const names = (x: unknown): string[] | null =>
  Array.isArray(x) ? x.filter((n): n is string => typeof n === 'string' && n.trim() !== '') : null;

export const loadPlayers = (): string[] => names(load<unknown>(PLAYERS, null)) ?? names(load<unknown>(OTHER_PLAYERS, null)) ?? [];
export const savePlayers = (list: string[]) => save(PLAYERS, list);

export const loadSetup = (): SetupPrefs => validSetup(load<unknown>(SETUP, null));
export const saveSetup = (p: SetupPrefs) => save(SETUP, p);
