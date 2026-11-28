// Joining, rejoining, leaving and removal for a table game whose players sit out a game once gone
// (Go Fish, Big 2). A player who drops keeps their seat; one who leaves or is removed mid-game is
// handed to the game's own `out`, and one who left may come back. No two players hold names that
// look the same.
import { sameName } from './names';

export type Player = { pid: string; name: string };
export type Room = { phase: string; players: Player[]; kicked: string[]; left: string[] };
export type Joined<G> = { error: string } | { error?: undefined; pid: string; game: G };

export const active = (g: Room) => g.players.filter((p) => !g.kicked.includes(p.pid));
export const isActive = (g: Room, pid: string) => g.players.some((p) => p.pid === pid) && !g.kicked.includes(pid);

/** Players who may still play: present, or gone and free to come back. */
const inRoom = (g: Room) => g.players.filter((p) => !g.kicked.includes(p.pid) || g.left.includes(p.pid));

/** Seats `pid` as `name` (cut to `nameMax`), or says why not; a room holds at most `max` players. */
export function join<G extends Room>(g: G, pid: string, name: string, online: ReadonlySet<string>, max: number, nameMax: number): Joined<G> {
  name = name.trim().slice(0, nameMax);
  if (!pid || Object.hasOwn(Object.prototype, pid) || !name) return { error: 'Enter a player name to join.' };
  const full = active(g).length >= max;
  if (g.left.includes(pid)) {
    if (full) return { error: 'This room is full.' };
    return { pid, game: { ...g, kicked: g.kicked.filter((x) => x !== pid), left: g.left.filter((x) => x !== pid) } };
  }
  if (g.kicked.includes(pid)) return { error: 'The host removed you from this room.' };
  if (g.players.some((p) => p.pid === pid)) return { pid, game: g };
  const match = sameName(inRoom(g), name);
  if (match) return online.has(match.pid) || g.left.includes(match.pid) ? { error: 'That name is already in use.' } : { pid: match.pid, game: g };
  if (full) return { error: 'This room is full.' };
  return { pid, game: { ...g, players: [...g.players, { pid, name }] } };
}

/** Removed by the host: gone from the lobby, or out of the game in play for good. */
export function kick<G extends Room>(g: G, pid: string, out: (g: G) => G): G {
  if (g.phase === 'lobby') return { ...g, players: g.players.filter((p) => p.pid !== pid), kicked: [...g.kicked, pid] };
  return out({ ...g, kicked: [...g.kicked, pid], left: g.left.filter((x) => x !== pid) });
}

/** "Leave room": gone from the lobby; mid-game out like a removed player, but free to come back. */
export function leave<G extends Room>(g: G, pid: string, out: (g: G) => G): G {
  if (!isActive(g, pid)) return g;
  if (g.phase === 'lobby') return { ...g, players: g.players.filter((p) => p.pid !== pid) };
  return out({ ...g, kicked: [...g.kicked, pid], left: [...g.left, pid] });
}
