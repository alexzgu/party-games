// What Snark Tank keeps on a device: the host screen's game (so a reload reopens the same room)
// and its settings; a phone's identity (so a reload rejoins as the same player) and unsent drafts.
import { load, remove, save } from '../../lib/storage';
import { isCode } from './code';
import { ANSWER_CHOICES, DEFAULT_SETTINGS, VOTE_CHOICES, type Game, type Settings } from './logic';

const GAME = 'snark:host';
const SETTINGS = 'snark:settings';
const ME = 'snark:me';
const DRAFTS = 'snark:drafts';

const PHASES = ['lobby', 'write', 'vote', 'reveal', 'scores', 'over'];

/** A saved game, or null when there is none or it is from an older shape. */
export function validGame(x: unknown): Game | null {
  if (!x || typeof x !== 'object') return null;
  const g = x as Game;
  const ok = typeof g.code === 'string' && isCode(g.code) && Array.isArray(g.players) && Array.isArray(g.items) && Array.isArray(g.log)
    && PHASES.includes(g.phase) && typeof g.round === 'number' && typeof g.at === 'number' && !!g.settings && Array.isArray(g.settings.packIds)
    && g.players.every((p) => typeof p?.pid === 'string' && typeof p.name === 'string' && typeof p.score === 'number');
  return ok ? g : null;
}

export const loadGame = (): Game | null => validGame(load<unknown>(GAME, null));
export const saveGame = (g: Game | null) => (g ? save(GAME, g) : remove(GAME));

export function loadSettings(): Settings {
  const s = load<Partial<Settings>>(SETTINGS, {});
  return {
    rounds: s.rounds === 2 ? 2 : 3,
    answerSecs: (ANSWER_CHOICES as readonly number[]).includes(s.answerSecs ?? 0) ? s.answerSecs! : DEFAULT_SETTINGS.answerSecs,
    voteSecs: (VOTE_CHOICES as readonly number[]).includes(s.voteSecs ?? 0) ? s.voteSecs! : DEFAULT_SETTINGS.voteSecs,
    packIds: Array.isArray(s.packIds) ? s.packIds.filter((id) => typeof id === 'string') : DEFAULT_SETTINGS.packIds,
  };
}
export const saveSettings = (s: Settings) => save(SETTINGS, s);

/** A phone's player: its id, the name it joined with and the room it is in. */
export interface Me { pid: string; name: string; code: string; /** The host has welcomed this phone into that room. */ joined?: boolean }

export function loadMe(): Me | null {
  const m = load<Partial<Me> | null>(ME, null);
  return m && typeof m.pid === 'string' && typeof m.name === 'string' && typeof m.code === 'string' ? (m as Me) : null;
}
export const saveMe = (m: Me | null) => (m ? save(ME, m) : remove(ME));

/** Half-typed answers, by room, round and prompt, so a reload mid-answer loses nothing. */
export const loadDraft = (key: string): string => load<Record<string, string>>(DRAFTS, {})[key] ?? '';
export function saveDraft(key: string, text: string): void {
  const all = load<Record<string, string>>(DRAFTS, {});
  if (text) all[key] = text; else delete all[key];
  // Only this game's drafts matter; drop the rest.
  const prefix = key.split('/')[0] + '/';
  save(DRAFTS, Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith(prefix))));
}
