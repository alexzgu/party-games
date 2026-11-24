import { load, save } from '../../lib/storage';
import { keepGame, loadSaved } from '../../lib/room/saved';
import { isCode } from '../../lib/room/code';
import { COUNTS, DEFAULT_SETTINGS, VOTE_TIMES, type Game, type Settings } from './logic';

const GAME = 'rather:host';
const SETTINGS = 'rather:settings';

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
    count: oneOf(COUNTS, s.count, d.count), seconds: oneOf(VOTE_TIMES, s.seconds, d.seconds),
    packs: Array.isArray(s.packs) && s.packs.length ? s.packs.filter((p) => typeof p === 'string') : d.packs,
  };
}
export const saveSettings = (s: Settings) => save(SETTINGS, s);
