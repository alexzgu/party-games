import { load, save } from '../../lib/storage';
import { keepGame, loadSaved } from '../../lib/room/saved';
import { isCode } from '../../lib/room/code';
import { DEFAULT_SETTINGS, TURN_TIMES, type Game, type Settings } from './logic';

const GAME = 'fish:host';
const SETTINGS = 'fish:settings';

function validGame(x: unknown): Game | null {
  const g = x as Game | null;
  return g && typeof g.code === 'string' && isCode(g.code) && Array.isArray(g.players) && Array.isArray(g.seats)
    && Array.isArray(g.pool) && Array.isArray(g.log) && g.hands && typeof g.hands === 'object' && g.books && typeof g.books === 'object' ? g : null;
}
export const loadRoom = () => loadSaved(GAME, validGame);
export const loadGame = (): Game | null => loadRoom().game;
export const saveGame = (g: Game | null, room: string) => keepGame(GAME, g, room);

export function loadSettings(): Settings {
  const s = load<Partial<Settings>>(SETTINGS, {});
  return { seconds: TURN_TIMES.includes(s.seconds as never) ? s.seconds! : DEFAULT_SETTINGS.seconds };
}
export const saveSettings = (s: Settings) => save(SETTINGS, s);
