import { load, save } from '../../lib/storage';
import { keepGame, loadSaved } from '../../lib/room/saved';
import { isCode } from '../../lib/room/code';
import { AWAY_CHOICES, AWAY_MS, type Game, type Phase } from './logic';

const GAME = 'salad:host';
const SETTINGS = 'salad:settings';
/** The packs a new room starts with, and what a room whose picks were all deleted ticks. */
export const DEFAULT_PACKS: readonly string[] = ['classic'];
const phases: Phase[] = ['lobby', 'pick', 'prepare', 'present', 'reveal', 'scores', 'over'];

function validGame(x: unknown): Game | null {
  const g = x as Game | null;
  return g && typeof g.code === 'string' && isCode(g.code) && phases.includes(g.phase)
    && Array.isArray(g.players) && Array.isArray(g.turns) && Array.isArray(g.pool)
    && Number.isInteger(g.serial) ? { ...g, awayMs: awayMs(g.awayMs) } : null;
}

/** The host's presenter wait, or the default for a room or settings saved before it was a choice. */
const awayMs = (x: unknown): number => ((AWAY_CHOICES as readonly unknown[]).includes(x) ? (x as number) : AWAY_MS);

export const loadRoom = () => loadSaved(GAME, validGame);
export const loadGame = (): Game | null => loadRoom().game;
export const saveGame = (g: Game | null, room: string) => keepGame(GAME, g, room);
export interface Settings { packIds: string[]; awayMs: number }

/** The host's settings; the older save was the pack list alone. */
export function loadSettings(): Settings {
  const raw = load<unknown>(SETTINGS, null);
  const saved = (Array.isArray(raw) ? { packIds: raw } : raw ?? {}) as Partial<Record<keyof Settings, unknown>>;
  const ids = Array.isArray(saved.packIds) ? saved.packIds.filter((id): id is string => typeof id === 'string') : [];
  return { packIds: ids.length ? ids : [...DEFAULT_PACKS], awayMs: awayMs(saved.awayMs) };
}
export const saveSettings = (s: Settings) => save(SETTINGS, s);
