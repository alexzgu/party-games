import { load, save } from '../../lib/storage';
import { keepGame, loadSaved } from '../../lib/room/saved';
import { isCode } from '../../lib/room/code';
import { ANSWER_TIMES, COUNTS, DEFAULT_SETTINGS, type Game, type Settings } from './logic';

const GAME = 'trivia:host';
const SETTINGS = 'trivia:settings';
const SOLO = 'trivia:solo';

function validGame(x: unknown): Game | null {
  const g = x as Game | null;
  return g && typeof g.code === 'string' && isCode(g.code) && Array.isArray(g.players) && Array.isArray(g.questions) && Array.isArray(g.asked) ? g : null;
}
export const loadRoom = () => loadSaved(GAME, validGame);
export const loadGame = (): Game | null => loadRoom().game;
export const saveGame = (g: Game | null, room: string) => keepGame(GAME, g, room);

const oneOf = <T>(list: readonly T[], x: unknown, fallback: T): T => list.includes(x as T) ? x as T : fallback;

export function loadSettings(): Settings {
  const s = load<Partial<Settings>>(SETTINGS, {});
  const d = DEFAULT_SETTINGS;
  return {
    count: oneOf(COUNTS, s.count, d.count), seconds: oneOf(ANSWER_TIMES, s.seconds, d.seconds),
    packs: Array.isArray(s.packs) && s.packs.length ? s.packs.filter((p) => typeof p === 'string') : d.packs,
  };
}
export const saveSettings = (s: Settings) => save(SETTINGS, s);

/** Solo on this phone: the best score, and the keys of the questions it has asked (as a room remembers them). */
export type SoloMemory = { best: number; asked: string[] };
export function loadSolo(): SoloMemory {
  const s = load<Partial<SoloMemory>>(SOLO, {});
  return {
    best: typeof s.best === 'number' && Number.isFinite(s.best) && s.best > 0 ? Math.round(s.best) : 0,
    asked: Array.isArray(s.asked) ? s.asked.filter((k) => typeof k === 'string') : [],
  };
}
export const saveSolo = (s: SoloMemory) => save(SOLO, s);
