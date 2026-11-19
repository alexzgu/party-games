// What Say What? remembers on this phone: the game in progress, the player list and the
// last setup. Everything goes through the guarded storage helpers.
import { load, remove, save } from '../../lib/storage';
import { validGame, validSetup, type GameState, type SetupPrefs } from './logic';

const GAME = 'gibberish:game';
const PLAYERS = 'gibberish:players';
const SETUP = 'gibberish:setup';

export const loadGame = (): GameState | null => validGame(load<unknown>(GAME, null));
export const saveGame = (s: GameState | null) => (s ? save(GAME, s) : remove(GAME));

export const loadPlayers = (): string[] => {
  const names = load<unknown>(PLAYERS, []);
  return Array.isArray(names) ? names.filter((n): n is string => typeof n === 'string' && n.trim() !== '') : [];
};
export const savePlayers = (names: string[]) => save(PLAYERS, names);

export const loadSetup = (): SetupPrefs => validSetup(load<unknown>(SETUP, null));
export const saveSetup = (p: SetupPrefs) => save(SETUP, p);
