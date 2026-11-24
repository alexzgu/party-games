// Joining, rejoining, leaving and removal. A player who drops keeps their seat, hand and score;
// one who leaves or is removed gives their hand back to the deck.
import type { Rand } from './deck';
import { sameName } from '../../lib/room/names';
import { MAX_PLAYERS, NAME_MAX, active, deal, isActive, type Game } from './state';

type Joined = { error: string } | { error?: undefined; pid: string; game: Game };

/** Players who may still play: present, or gone and free to come back; no two hold names that look the same. */
const inRoom = (g: Game) => g.players.filter((p) => !g.kicked.includes(p.pid) || g.left.includes(p.pid));

/** Late joiners and returning leavers are dealt ten at once and play from the next prompt. */
const seat = (g: Game, pid: string, rand: Rand) => g.phase === 'lobby' || g.phase === 'over' ? g : deal(g, pid, rand);

export function join(g: Game, pid: string, name: string, online: ReadonlySet<string>, rand: Rand = Math.random): Joined {
  name = name.trim().slice(0, NAME_MAX);
  if (!pid || Object.hasOwn(Object.prototype, pid) || pid === 'house' || !name) return { error: 'Enter a player name to join.' };
  const full = active(g).length >= MAX_PLAYERS;
  if (g.left.includes(pid)) {
    if (full) return { error: 'This room is full.' };
    return { pid, game: seat({ ...g, kicked: g.kicked.filter((x) => x !== pid), left: g.left.filter((x) => x !== pid) }, pid, rand) };
  }
  if (g.kicked.includes(pid)) return { error: 'The host removed you from this room.' };
  if (g.players.some((p) => p.pid === pid)) return { pid, game: g };
  const match = sameName(inRoom(g), name);
  if (match) return online.has(match.pid) || g.left.includes(match.pid) ? { error: 'That name is already in use.' } : { pid: match.pid, game: g };
  if (full) return { error: 'This room is full.' };
  return { pid, game: seat({ ...g, players: [...g.players, { pid, name, score: 0 }] }, pid, rand) };
}

/** Out of the game: their hand goes back into the deck, and an answer not yet shown with it. */
function depart(g: Game, pid: string): Game {
  const r = g.round;
  const shown = g.phase !== 'answer';
  const play = r && !shown ? r.plays[pid] : undefined;
  const { [pid]: hand = [], ...hands } = g.hands;
  const back = [...hand, ...play?.cards ?? []];
  const round = r && !shown ? { ...r, players: r.players.filter((x) => x !== pid), plays: omit(r.plays, pid) } : r;
  return { ...g, hands, deck: [...g.deck, ...back], round };
}

const omit = <T>(rec: Record<string, T>, key: string) => {
  const { [key]: _, ...rest } = rec;
  return rest;
};

export function kick(g: Game, pid: string): Game {
  if (g.phase === 'lobby') return { ...g, players: g.players.filter((p) => p.pid !== pid), kicked: [...g.kicked, pid] };
  return { ...depart(g, pid), kicked: [...g.kicked, pid], left: g.left.filter((x) => x !== pid) };
}

/** "Leave room": gone from the lobby; mid-game out like a removed player, but free to come back with their score. */
export function leave(g: Game, pid: string): Game {
  if (!isActive(g, pid)) return g;
  if (g.phase === 'lobby') return { ...g, players: g.players.filter((p) => p.pid !== pid) };
  return { ...depart(g, pid), kicked: [...g.kicked, pid], left: [...g.left, pid] };
}
