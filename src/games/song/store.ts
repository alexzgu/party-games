// What Earworm remembers on this phone: the game in progress, the player list, the last setup
// and the songs YouTube refused to play here. Everything goes through the guarded storage helpers.
import { load, remove, save } from '../../lib/storage';
import { validGame, validSetup, type GameState, type SetupPrefs } from './logic';

const GAME = 'song:game';
const PLAYERS = 'song:players';
const SETUP = 'song:setup';
const BROKEN = 'song:broken';

export const loadGame = (): GameState | null => validGame(load<unknown>(GAME, null));
export const saveGame = (s: GameState | null) => (s ? save(GAME, s) : remove(GAME));

export const loadPlayers = (): string[] => {
  const names = load<unknown>(PLAYERS, []);
  return Array.isArray(names) ? names.filter((n): n is string => typeof n === 'string' && n.trim() !== '') : [];
};
export const savePlayers = (names: string[]) => save(PLAYERS, names);

export const loadSetup = (): SetupPrefs => validSetup(load<unknown>(SETUP, null));
export const saveSetup = (p: SetupPrefs) => save(SETUP, p);

/** Video ids YouTube said can never play embedded (removed, or embedding off): never dealt again here. */
export const loadBroken = (): string[] => {
  const ids = load<unknown>(BROKEN, []);
  return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : [];
};
export const markBroken = (id: string) => {
  const ids = loadBroken();
  if (!ids.includes(id)) save(BROKEN, [...ids, id].slice(-200));
};
