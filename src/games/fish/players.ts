// Joining, rejoining, leaving and removal (lib/room/seating.ts). A player who drops keeps their
// seat and hand; one who leaves or is removed mid-game is out (round.ts `out`: their hand goes back
// into the pool, their books stay down), and one who left may come back to play on with their books
// and an empty hand. Late joiners watch until the next deal.
import * as S from '../../lib/room/seating';
import { out } from './round';
import { MAX_PLAYERS, NAME_MAX, type Game } from './state';

type Rand = () => number;

export const join = (g: Game, pid: string, name: string, online: ReadonlySet<string>): S.Joined<Game> =>
  S.join(g, pid, name, online, MAX_PLAYERS, NAME_MAX);

export const kick = (g: Game, pid: string, now: number, rand: Rand = Math.random): Game =>
  S.kick(g, pid, (x) => out(x, pid, now, rand));

/** "Leave room": gone from the lobby; mid-game out like a removed player, but free to come back with their books. */
export const leave = (g: Game, pid: string, now: number, rand: Rand = Math.random): Game =>
  S.leave(g, pid, (x) => out(x, pid, now, rand));
