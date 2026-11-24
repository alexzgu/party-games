import type { View } from './view';

/** A player's name in a view. */
export const nameIn = (v: View) => (pid: string) => v.players.find((p) => p.pid === pid)?.name ?? 'A player who left';

/** Where a seat stands this phase, in words (never colour alone). */
export function seatStatus(v: View, pid: string, online?: ReadonlySet<string>): string {
  if (v.phase === 'vote' && v.voted?.includes(pid)) return 'Voted';
  if (online && !online.has(pid)) return 'Away';
  return v.phase === 'vote' ? 'Choosing' : '';
}

/** The headline of a reveal: the split ("3 to 2"), a tie, or nobody. */
export function outcome(v: View): string {
  const t = v.tally;
  if (!t || t.counts[0] + t.counts[1] === 0) return 'Nobody voted.';
  if (t.winner === null) return 'Split down the middle. No points.';
  return `${t.counts[t.winner]} to ${t.counts[1 - t.winner]}`;
}
