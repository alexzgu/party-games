import { HOUSE } from './logic';
import type { View } from './view';

/** A player's name in a view, or the house's. */
export const nameIn = (v: View) => (pid: string) => pid === HOUSE ? 'The house' : v.players.find((p) => p.pid === pid)?.name ?? 'A player who left';

/** Where a seat stands this phase, in words (never colour alone). */
export function seatStatus(v: View, pid: string, online?: ReadonlySet<string>): string {
  if (v.phase === 'lobby') return online && !online.has(pid) ? 'Away' : '';
  if (pid === v.judge) return 'Judge';
  if (v.phase === 'answer' && !v.answering?.includes(pid)) return 'Plays next prompt';
  if (v.progress?.includes(pid)) return v.phase === 'vote' ? 'Voted' : 'Played';
  if (online && !online.has(pid)) return 'Away';
  return v.phase === 'answer' ? 'Choosing' : '';
}
