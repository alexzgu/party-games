import { load, remove, save } from '../../lib/storage';
import { isCode } from '../../lib/room/code';
import type { Game, Phase } from './logic';

const GAME = 'salad:host';
const SETTINGS = 'salad:settings';
const phases: Phase[] = ['lobby', 'pick', 'prepare', 'present', 'reveal', 'scores', 'over'];

export function loadGame(): Game | null {
  const g = load<Game | null>(GAME, null);
  return g && typeof g.code === 'string' && isCode(g.code) && phases.includes(g.phase)
    && Array.isArray(g.players) && Array.isArray(g.turns) && Array.isArray(g.pool)
    && Number.isInteger(g.serial) ? g : null;
}

export const saveGame = (g: Game | null) => g ? save(GAME, g) : remove(GAME);
export function loadSettings(): string[] {
  const ids = load<unknown>(SETTINGS, null);
  return Array.isArray(ids) && ids.length ? ids.filter((id) => typeof id === 'string') : ['classic'];
}
export const saveSettings = (ids: string[]) => save(SETTINGS, ids);
