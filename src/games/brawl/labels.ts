import type { View } from './view';
export function phaseLabel(v: View): string {
  if (v.phase === 'vote' && v.rematch) return 'Rematch vote';
  return {
    lobby: 'Lobby', draw: 'Draw your fighter', challenge: 'Draw a challenger', title: 'The title',
    vote: 'Pick a fighter', payout: 'Bout results', tag: 'Keep or tag in', scores: 'Round scores', over: 'Final standings',
  }[v.phase];
}
