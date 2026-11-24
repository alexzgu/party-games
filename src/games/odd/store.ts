// What Odd One Out remembers on this phone: the game in progress, the player list and the last
// setup, picks included, under its own keys (Heads Down.'s picks and settings are never written).
import { load, remove, save } from '../../lib/storage';
import type { GameState } from './logic';
import { validGame, validSetup, type SetupPrefs } from './valid';
import { wordDecks } from '../../lib/content';
import { defaultPicks } from './deal';

const GAME = 'odd:game';
const PLAYERS = 'odd:players';
const SETUP = 'odd:setup';
/** Brain Freeze's player list: the same friends, so a first game here starts with them. */
const OTHER_PLAYERS = 'quick:players';

export const loadGame = (): GameState | null => validGame(load<unknown>(GAME, null));
export const saveGame = (s: GameState | null) => (s ? save(GAME, s) : remove(GAME));

const names = (x: unknown): string[] | null =>
  Array.isArray(x) ? x.filter((n): n is string => typeof n === 'string' && n.trim() !== '') : null;

export const loadPlayers = (): string[] => names(load<unknown>(PLAYERS, null)) ?? names(load<unknown>(OTHER_PLAYERS, null)) ?? [];
export const savePlayers = (list: string[]) => save(PLAYERS, list);

export const loadSetup = (): SetupPrefs => validSetup(load<unknown>(SETUP, null));
export const saveSetup = (p: SetupPrefs) => save(SETUP, p);

/** The packs picked in setup now (the first-visit picks when nothing was saved yet). */
export const setupPicks = (): string[] => loadSetup().packIds ?? defaultPicks(wordDecks());
