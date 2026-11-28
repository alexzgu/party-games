// Joining, rejoining, leaving and removal (lib/room/seating.ts). A player who drops keeps their
// seat and hand; one who leaves or is removed mid-deal is out (round.ts `out`: their cards are set
// aside), and one who left may come back, dealt in again at the next deal with their points. Late
// joiners watch until the next game.
import * as S from '../../lib/room/seating';
import { out } from './round';
import { MAX_PLAYERS, NAME_MAX, type Game } from './state';

export const join = (g: Game, pid: string, name: string, online: ReadonlySet<string>): S.Joined<Game> =>
  S.join(g, pid, name, online, MAX_PLAYERS, NAME_MAX);

export const kick = (g: Game, pid: string, now: number): Game => S.kick(g, pid, (x) => out(x, pid, now));

/** "Leave room": gone from the lobby; mid-game out like a removed player, but free to come back with their points. */
export const leave = (g: Game, pid: string, now: number): Game => S.leave(g, pid, (x) => out(x, pid, now));
