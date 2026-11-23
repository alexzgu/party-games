import { load, save, remove } from '../../lib/storage';
import { keepGame, loadSaved } from '../../lib/room/saved';
import { DEFAULT_SETTINGS, DRAW_TIMES, type Game, type Settings } from './logic';
import type { Drawing } from '../../lib/ink';

export const loadRoom = () => loadSaved('brawl:host', (x) => x as Game);
export const loadGame = () => loadRoom().game;
export const saveGame = (g: Game | null, room: string) => keepGame('brawl:host', g, room);
export const loadArt = () => load<Record<string, Drawing>>('brawl:art', {});
export const saveArt = (a: Record<string, Drawing>) => save('brawl:art', a);
export const clearArt = () => remove('brawl:art');

export function loadSettings(): Settings {
  const s = load<Settings>('brawl:settings', DEFAULT_SETTINGS);
  return {
    seconds: DRAW_TIMES.some((time) => time === s.seconds) ? s.seconds : DEFAULT_SETTINGS.seconds,
    packs: Array.isArray(s.packs) && s.packs.length ? s.packs : DEFAULT_SETTINGS.packs,
  };
}
export const saveSettings = (s: Settings) => save('brawl:settings', s);

type Draft = { id: string; name: string; drawing: Drawing; sent?: boolean };
export const loadDraft = (id: string): Draft => {
  const saved = load<Draft | null>('brawl:draft', null);
  return saved?.id === id ? saved : { id, name: '', drawing: [] };
};
export const saveDraft = (draft: Draft) => save('brawl:draft', draft);
