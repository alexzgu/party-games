// Joining, rejoining, leaving and removal, as Bad Hand's. A player who drops keeps their seat and
// score; one who leaves or is removed is out (their vote on the question in play no longer counts).
import { sameName } from '../../lib/room/names';
import { MAX_PLAYERS, NAME_MAX, active, isActive, type Game } from './state';

type Joined = { error: string } | { error?: undefined; pid: string; game: Game };

/** Players who may still play: present, or gone and free to come back; no two hold names that look the same. */
const inRoom = (g: Game) => g.players.filter((p) => !g.kicked.includes(p.pid) || g.left.includes(p.pid));

/** Late joiners are seated at once and may vote on the question in play. */
export function join(g: Game, pid: string, name: string, online: ReadonlySet<string>): Joined {
  name = name.trim().slice(0, NAME_MAX);
  if (!pid || Object.hasOwn(Object.prototype, pid) || !name) return { error: 'Enter a player name to join.' };
  const full = active(g).length >= MAX_PLAYERS;
  if (g.left.includes(pid)) {
    if (full) return { error: 'This room is full.' };
    return { pid, game: { ...g, kicked: g.kicked.filter((x) => x !== pid), left: g.left.filter((x) => x !== pid) } };
  }
  if (g.kicked.includes(pid)) return { error: 'The host removed you from this room.' };
  if (g.players.some((p) => p.pid === pid)) return { pid, game: g };
  const match = sameName(inRoom(g), name);
  if (match) return online.has(match.pid) || g.left.includes(match.pid) ? { error: 'That name is already in use.' } : { pid: match.pid, game: g };
  if (full) return { error: 'This room is full.' };
  return { pid, game: { ...g, players: [...g.players, { pid, name, score: 0 }] } };
}

export function kick(g: Game, pid: string): Game {
  if (g.phase === 'lobby') return { ...g, players: g.players.filter((p) => p.pid !== pid), kicked: [...g.kicked, pid] };
  return { ...g, kicked: [...g.kicked, pid], left: g.left.filter((x) => x !== pid) };
}

/** "Leave room": gone from the lobby; mid-game out like a removed player, but free to come back with their score. */
export function leave(g: Game, pid: string): Game {
  if (!isActive(g, pid)) return g;
  if (g.phase === 'lobby') return { ...g, players: g.players.filter((p) => p.pid !== pid) };
  return { ...g, kicked: [...g.kicked, pid], left: [...g.left, pid] };
}
