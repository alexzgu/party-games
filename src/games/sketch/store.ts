import { load, save, remove } from '../../lib/storage';
import type { Drawing } from '../../lib/ink';
import { DEFAULT_SETTINGS, DRAW_TIMES, GUESS_TIMES, ROUND_CHOICES, WRITE_TIMES, type Game, type Settings } from './core';

export const loadGame = () => load<Game | null>('sketch:host', null);
export const saveGame = (g: Game | null) => g ? save('sketch:host', g) : remove('sketch:host');
export const loadArt = () => load<Record<string, Drawing>>('sketch:art', {});
export const saveArt = (a: Record<string, Drawing>) => save('sketch:art', a);
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
