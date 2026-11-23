import { load, remove, save } from '../../lib/storage';
import { isCode } from '../../lib/room/code';
import { ANSWER_TIMES, DEFAULT_SETTINGS, TARGETS, type Game, type Settings } from './logic';

const GAME = 'hand:host';
const SETTINGS = 'hand:settings';

export function loadGame(): Game | null {
  const g = load<Game | null>(GAME, null);
  return g && typeof g.code === 'string' && isCode(g.code) && Array.isArray(g.players) && g.hands && Array.isArray(g.deck) ? g : null;
}
export const saveGame = (g: Game | null) => g ? save(GAME, g) : remove(GAME);

const oneOf = <T>(list: readonly T[], x: unknown, fallback: T): T => list.includes(x as T) ? x as T : fallback;

export function loadSettings(): Settings {
  const s = load<Partial<Settings>>(SETTINGS, {});
  const d = DEFAULT_SETTINGS;
  return {
    seconds: oneOf(ANSWER_TIMES, s.seconds, d.seconds), target: oneOf(TARGETS, s.target, d.target),
    packs: Array.isArray(s.packs) && s.packs.length ? s.packs.filter((p) => typeof p === 'string') : d.packs,
    trade: s.trade === true, house: s.house === true, blanks: s.blanks === true,
  };
}
export const saveSettings = (s: Settings) => save(SETTINGS, s);
