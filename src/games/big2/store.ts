import { load, save } from '../../lib/storage';
import { keepGame, loadSaved } from '../../lib/room/saved';
import { isCode } from '../../lib/room/code';
import { DEAL_COUNTS, DEFAULT_SETTINGS, TURN_TIMES, type Game, type Settings } from './logic';

const GAME = 'big2:host';
const SETTINGS = 'big2:settings';

function validGame(x: unknown): Game | null {
  const g = x as Game | null;
  return g && typeof g.code === 'string' && isCode(g.code) && Array.isArray(g.players) && Array.isArray(g.seats) && Array.isArray(g.roster)
    && Array.isArray(g.passed) && Array.isArray(g.log) && g.hands && typeof g.hands === 'object' && g.totals && typeof g.totals === 'object'
    && g.gone && typeof g.gone === 'object' && g.settings && typeof g.settings === 'object' ? g : null;
}
export const loadRoom = () => loadSaved(GAME, validGame);
export const loadGame = (): Game | null => loadRoom().game;
export const saveGame = (g: Game | null, room: string) => keepGame(GAME, g, room);

export function loadSettings(): Settings {
  const s = load<Partial<Settings>>(SETTINGS, {});
  return {
    deals: DEAL_COUNTS.includes(s.deals as never) ? s.deals! : DEFAULT_SETTINGS.deals,
    seconds: TURN_TIMES.includes(s.seconds as never) ? s.seconds! : DEFAULT_SETTINGS.seconds,
  };
}
export const saveSettings = (s: Settings) => save(SETTINGS, s);
