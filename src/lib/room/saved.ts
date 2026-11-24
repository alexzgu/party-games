// A host screen's saved game, with its room's id written into the same record: the seats' keys
// (seats.ts) are trusted only when their own record names that room, so a game saved late by a
// forgotten tab never meets another room's keys. The games themselves never see the id.
import { load, remove, save } from '../storage';

/** `room`: the id of the room the game was saved in; empty without one, or without a game. */
export interface Saved<G> { game: G | null; room: string }

/** Read in one go, so the id is always this game's; `valid`: the game, or null for an older shape. */
export function loadSaved<G>(key: string, valid: (x: unknown) => G | null): Saved<G> {
  const s = load<unknown>(key, null);
  if (!s || typeof s !== 'object') return { game: null, room: '' };
  const { room, ...rest } = s as { room?: unknown };
  const game = valid(rest);
  return { game, room: game && typeof room === 'string' ? room : '' };
}

export const keepGame = (key: string, g: object | null, room: string): void => (g ? save(key, { ...g, room }) : remove(key));
