// What Snark Tank keeps on a device: the host screen's game (so a reload reopens the same room)
// and its settings; a phone's unsent drafts (its identity is kept by the shared room link).
import { load, save } from '../../lib/storage';
import { keepGame, loadSaved } from '../../lib/room/saved';
import { isCode } from '../../lib/room/code';
import { ANSWER_CHOICES, DEFAULT_SETTINGS, VOTE_CHOICES, type Game, type Settings } from './logic';

const GAME = 'snark:host';
const SETTINGS = 'snark:settings';
const DRAFTS = 'snark:drafts';

const PHASES = ['lobby', 'write', 'show', 'vote', 'reveal', 'scores', 'over'];

/** A saved game, or null when there is none or it is from an older shape. */
export function validGame(x: unknown): Game | null {
  if (!x || typeof x !== 'object') return null;
  const g = x as Game;
  const ok = typeof g.code === 'string' && isCode(g.code) && Array.isArray(g.players) && Array.isArray(g.items) && Array.isArray(g.log)
    && PHASES.includes(g.phase) && typeof g.round === 'number' && typeof g.at === 'number' && !!g.settings && Array.isArray(g.settings.packIds)
    && g.players.every((p) => typeof p?.pid === 'string' && typeof p.name === 'string' && typeof p.score === 'number');
  return ok ? g : null;
}

export const loadRoom = () => loadSaved(GAME, validGame);
export const loadGame = (): Game | null => loadRoom().game;
export const saveGame = (g: Game | null, room: string) => keepGame(GAME, g, room);

export function loadSettings(): Settings {
  const s = load<Partial<Settings>>(SETTINGS, {});
  return {
    rounds: s.rounds === 2 ? 2 : 3,
    answerSecs: (ANSWER_CHOICES as readonly number[]).includes(s.answerSecs ?? 0) ? s.answerSecs! : DEFAULT_SETTINGS.answerSecs,
    voteSecs: (VOTE_CHOICES as readonly number[]).includes(s.voteSecs ?? 0) ? s.voteSecs! : DEFAULT_SETTINGS.voteSecs,
    packIds: Array.isArray(s.packIds) ? s.packIds.filter((id) => typeof id === 'string') : DEFAULT_SETTINGS.packIds,
    final: s.final === 'duels' ? 'duels' : 'everyone',
  };
}
export const saveSettings = (s: Settings) => save(SETTINGS, s);

/** Half-typed answers, by room, round and prompt, so a reload mid-answer loses nothing. */
export const loadDraft = (key: string): string => load<Record<string, string>>(DRAFTS, {})[key] ?? '';
export function saveDraft(key: string, text: string): void {
  const all = load<Record<string, string>>(DRAFTS, {});
  if (text) all[key] = text; else delete all[key];
  // Only this game's drafts matter; drop the rest.
  const prefix = key.split('/')[0] + '/';
  save(DRAFTS, Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith(prefix))));
}
