// Where Tuned In keeps its settings and the game in progress (localStorage via lib/storage).
import { load, remove, save } from '../../lib/storage';
import { DEFAULT_NAMES } from './look';
import { restore, type Config, type Game } from './state';

const CONFIG_KEY = 'dial:config';
const GAME_KEY = 'dial:game';

const DEFAULT_CONFIG: Config = { names: DEFAULT_NAMES, goal: 10, steal: false, packIds: ['classic'] };

export function loadConfig(): Config {
  const c = load<Config>(CONFIG_KEY, DEFAULT_CONFIG);
  const names = Array.isArray(c.names) && c.names.length === 2 ? c.names : DEFAULT_NAMES;
  const goal = Number.isFinite(c.goal) ? Math.min(30, Math.max(5, Math.round(c.goal))) : DEFAULT_CONFIG.goal;
  const packIds = Array.isArray(c.packIds) ? c.packIds.filter((x) => typeof x === 'string') : DEFAULT_CONFIG.packIds;
  return { names: [String(names[0]), String(names[1])], goal, steal: !!c.steal, packIds };
}

export const saveConfig = (c: Config): void => save(CONFIG_KEY, c);

export const loadGame = (): Game | null => restore(load<unknown>(GAME_KEY, null));
export const saveGame = (g: Game): void => save(GAME_KEY, g);
export const clearGame = (): void => remove(GAME_KEY);

/** Remembers a newly made pack in the setup selection. */
export function selectPack(id: string): void {
  const c = loadConfig();
  if (!c.packIds.includes(id)) saveConfig({ ...c, packIds: [...c.packIds, id] });
}
