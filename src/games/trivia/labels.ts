import type { Choice } from './state';
import type { View } from './view';

/** A player's name in a view. */
export const nameIn = (v: View) => (pid: string) => v.players.find((p) => p.pid === pid)?.name ?? 'A player who left';

/** Each answer's letter, shown on its tile so colour is never the only cue. */
export const MARKS: Record<Choice, string> = { 0: 'A', 1: 'B', 2: 'C', 3: 'D' };

/** Where a seat stands this phase, in words (never colour alone). */
export function seatStatus(v: View, pid: string, online?: ReadonlySet<string>): string {
  if (v.phase === 'answer' && v.answered?.includes(pid)) return 'Answered';
  if (online && !online.has(pid)) return 'Away';
  return v.phase === 'answer' ? 'Thinking' : '';
}

/** "+870" for points gained. */
export const gain = (points: number) => `+${points}`;
