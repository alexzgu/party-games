// What Earworm remembers on this phone: the game in progress, the player list, the last setup,
// the clip starts the picker chose, and an unfinished "Add songs" review. Everything goes through the guarded storage helpers.
import { load, remove, save } from '../../lib/storage';
import { validGame, validSetup, type GameState, type SetupPrefs } from './logic';
import { PICK_VERSION } from './pick';

const GAME = 'song:game';
const PLAYERS = 'song:players';
const SETUP = 'song:setup';
const AUTO = 'song:auto';
const ADDING = 'song:adding:';

export const loadGame = (): GameState | null => validGame(load<unknown>(GAME, null));
export const saveGame = (s: GameState | null) => (s ? save(GAME, s) : remove(GAME));
/** The saved game as stored, whatever its format (to retire a YouTube-era save). */
export const loadRawGame = (): unknown => load<unknown>(GAME, null);
export const dropGame = () => remove(GAME);

export const loadPlayers = (): string[] => {
  const names = load<unknown>(PLAYERS, []);
  return Array.isArray(names) ? names.filter((n): n is string => typeof n === 'string' && n.trim() !== '') : [];
};
export const savePlayers = (names: string[]) => save(PLAYERS, names);

export const loadSetup = (): SetupPrefs => validSetup(load<unknown>(SETUP, null));
export const saveSetup = (p: SetupPrefs) => save(SETUP, p);

interface AutoStarts { v: number; starts: Record<string, number> }
const autoStarts = (): AutoStarts => {
  const a = load<AutoStarts>(AUTO, { v: PICK_VERSION, starts: {} });
  return a.v === PICK_VERSION && a.starts && typeof a.starts === 'object' ? a : { v: PICK_VERSION, starts: {} };
};
/** The clip start the picker chose for a track on this phone, or null. */
export const loadAutoStart = (id: number): number | null => {
  const s = autoStarts().starts[id];
  return typeof s === 'number' && Number.isFinite(s) ? s : null;
};
export const saveAutoStart = (id: number, start: number) => {
  const a = autoStarts();
  const starts: Record<string, number> = { ...a.starts, [id]: start };
  const keys = Object.keys(starts);
  save(AUTO, { v: PICK_VERSION, starts: keys.length > 2000 ? Object.fromEntries(keys.slice(-2000).map((k) => [k, starts[k]])) : starts });
};

/** An unfinished "Add songs" review for a pack, so a reload or a phone call loses nothing. */
export const loadAdding = <T>(packId: string, fallback: T): T => load<T>(ADDING + packId, fallback);
export const saveAdding = <T>(packId: string, value: T | null) => (value ? save(ADDING + packId, value) : remove(ADDING + packId));
