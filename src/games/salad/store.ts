import { load, remove, save } from '../../lib/storage';
import { isCode } from '../../lib/room/code';
import { AWAY_CHOICES, AWAY_MS, type Game, type Phase } from './logic';

const GAME = 'salad:host';
const SETTINGS = 'salad:settings';
const phases: Phase[] = ['lobby', 'pick', 'prepare', 'present', 'reveal', 'scores', 'over'];

export function loadGame(): Game | null {
  const g = load<Game | null>(GAME, null);
  return g && typeof g.code === 'string' && isCode(g.code) && phases.includes(g.phase)
    && Array.isArray(g.players) && Array.isArray(g.turns) && Array.isArray(g.pool)
    && Number.isInteger(g.serial) ? { ...g, awayMs: awayMs(g.awayMs) } : null;
}

/** The host's presenter wait, or the default for a room or settings saved before it was a choice. */
const awayMs = (x: unknown): number => ((AWAY_CHOICES as readonly unknown[]).includes(x) ? (x as number) : AWAY_MS);

export const saveGame = (g: Game | null) => g ? save(GAME, g) : remove(GAME);
export interface Settings { packIds: string[]; awayMs: number }

/** The host's settings; the older save was the pack list alone. */
export function loadSettings(): Settings {
  const raw = load<unknown>(SETTINGS, null);
  const saved = (Array.isArray(raw) ? { packIds: raw } : raw ?? {}) as Partial<Record<keyof Settings, unknown>>;
  const ids = Array.isArray(saved.packIds) ? saved.packIds.filter((id): id is string => typeof id === 'string') : [];
  return { packIds: ids.length ? ids : ['classic'], awayMs: awayMs(saved.awayMs) };
}
export const saveSettings = (s: Settings) => save(SETTINGS, s);
