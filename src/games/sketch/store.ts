import { load, save, remove } from '../../lib/storage';
import { keepGame, loadSaved } from '../../lib/room/saved';
import type { Drawing } from '../../lib/ink';
import { DEFAULT_SETTINGS, DRAW_TIMES, GUESS_TIMES, ROUND_CHOICES, WRITE_TIMES, type Game, type Settings } from './core';

export const loadRoom = () => loadSaved('sketch:host', (x) => x as Game);
export const loadGame = () => loadRoom().game;
export const saveGame = (g: Game | null, room: string) => keepGame('sketch:host', g, room);
const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
/**
 * The drawings of the room `room` (its id, as saved with its game): another room's are none. A
 * record from before drawings carried their room (drawing ids only) belongs to the one game saved
 * then, which has no room id either (`room` empty); a game with a room id never takes one.
 */
export function loadArt(room: string): Record<string, Drawing> {
  const s = load<unknown>('sketch:art', null);
  if (!isObject(s)) return {};
  const tagged = typeof s.room === 'string' && isObject(s.art);
  if (!tagged) return room ? {} : s as Record<string, Drawing>;
  return room && s.room === room ? s.art as Record<string, Drawing> : {};
}
export const saveArt = (a: Record<string, Drawing>, room: string) => save('sketch:art', { room, art: a });
export const clearArt = () => remove('sketch:art');

const oneOf = <T>(choices: readonly T[], x: unknown, fallback: T): T => choices.includes(x as T) ? x as T : fallback;

export function loadSettings(): Settings {
  const s = load<Partial<Settings>>('sketch:settings', DEFAULT_SETTINGS);
  const d = DEFAULT_SETTINGS;
  return {
    mode: oneOf(['telephone', 'guess'] as const, s.mode, d.mode),
    packs: Array.isArray(s.packs) && s.packs.length ? s.packs : d.packs,
    writeSecs: oneOf(WRITE_TIMES, s.writeSecs, d.writeSecs),
    drawSecs: oneOf(DRAW_TIMES, s.drawSecs, d.drawSecs),
    rounds: oneOf(ROUND_CHOICES, s.rounds, d.rounds),
    guessSecs: oneOf(GUESS_TIMES, s.guessSecs, d.guessSecs),
  };
}
export const saveSettings = (s: Settings) => save('sketch:settings', s);

/** What this phone has typed or drawn for one job (a Telephone step, a turn's drawing, a guess), so a reload keeps it. */
export type Draft = { id: string; text: string; drawing: Drawing; sent?: boolean };
export function loadDraft(id: string): Draft {
  const saved = load<Draft | null>('sketch:draft', null);
  return saved?.id === id ? saved : { id, text: '', drawing: [] };
}
/** Whether this phone has saved one for this job, a cleared one too. */
export const hasDraft = (id: string): boolean => load<Draft | null>('sketch:draft', null)?.id === id;
export const saveDraft = (draft: Draft) => save('sketch:draft', draft);
