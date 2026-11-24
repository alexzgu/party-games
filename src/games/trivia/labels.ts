import type { Choice } from './state';
import type { View } from './view';

/** A player's name in a view. */
export const nameIn = (v: View) => (pid: string) => v.players.find((p) => p.pid === pid)?.name ?? 'A player who left';

/** Each answer's letter and shape, so colour is never the only cue. */
export const MARKS: Record<Choice, { letter: string; shape: string }> = {
  0: { letter: 'A', shape: '▲' }, 1: { letter: 'B', shape: '◆' }, 2: { letter: 'C', shape: '●' }, 3: { letter: 'D', shape: '■' },
};

/** Where a seat stands this phase, in words (never colour alone). */
export function seatStatus(v: View, pid: string, online?: ReadonlySet<string>): string {
  if (v.phase === 'answer' && v.answered?.includes(pid)) return 'Answered';
  if (online && !online.has(pid)) return 'Away';
  return v.phase === 'answer' ? 'Thinking' : '';
}

/** "+870" for points gained. */
export const gain = (points: number) => `+${points}`;
