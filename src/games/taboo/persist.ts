// Where Don't Say It keeps its settings and the game in progress (localStorage via lib/storage).
import { load, remove, save } from '../../lib/storage';
import { DEFAULT_NAMES } from './look';
import { restore, SECONDS, type Config, type Game } from './state';

const CONFIG_KEY = 'taboo:config';
const GAME_KEY = 'taboo:game';

export const DEFAULT_CONFIG: Config = { names: DEFAULT_NAMES, seconds: 60, mode: 'score', goal: 15, rounds: 5, skipCost: false, packIds: ['classic', 'pop-culture'] };
export const GOAL = { min: 5, max: 50, step: 5 } as const;
export const ROUNDS = { min: 1, max: 10 } as const;

const within = (n: unknown, min: number, max: number, fallback: number): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;

/** The saved setup, with anything missing or out of range put back to its default. */
export function loadConfig(): Config {
  const c = load<Config>(CONFIG_KEY, DEFAULT_CONFIG);
  const names = Array.isArray(c.names) && c.names.length === 2 ? c.names : DEFAULT_NAMES;
  return {
    names: [String(names[0]), String(names[1])],
    seconds: (SECONDS as readonly number[]).includes(c.seconds) ? c.seconds : DEFAULT_CONFIG.seconds,
    mode: c.mode === 'rounds' ? 'rounds' : 'score',
    goal: within(c.goal, GOAL.min, GOAL.max, DEFAULT_CONFIG.goal),
    rounds: within(c.rounds, ROUNDS.min, ROUNDS.max, DEFAULT_CONFIG.rounds),
    skipCost: !!c.skipCost,
    packIds: Array.isArray(c.packIds) ? c.packIds.filter((x) => typeof x === 'string') : DEFAULT_CONFIG.packIds,
  };
}

export const saveConfig = (c: Config): void => save(CONFIG_KEY, c);

export const loadGame = (): Game | null => restore(load<unknown>(GAME_KEY, null));
export const saveGame = (g: Game): void => save(GAME_KEY, g);
export const clearGame = (): void => remove(GAME_KEY);

/** Ticks a newly made pack in the setup list. */
export function selectPack(id: string): void {
  const c = loadConfig();
  if (!c.packIds.includes(id)) saveConfig({ ...c, packIds: [...c.packIds, id] });
}
