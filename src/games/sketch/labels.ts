import type { View } from './view';

/** The heading over each phase; `me` is the phone's player (none on the host screen). */
export function phaseLabel(v: View, me?: string): string {
  if (me && me === v.drawer && (v.phase === 'pick' || v.phase === 'guess')) return v.phase === 'pick' ? 'Pick a word to draw' : 'Draw the word';
  if (me && v.phase === 'guess' && v.got?.includes(me)) return 'You got it!';
  if (me && v.step !== undefined && v.order && !v.order.includes(me)) return 'Watching this game';
  return {
    lobby: 'Lobby', write: 'Write a line', draw: 'Draw what you were handed', describe: 'Describe the drawing',
    album: 'The album', pick: 'Choosing a word', guess: 'Guess the drawing', reveal: 'The word was',
    scores: 'Round scores', over: 'Final standings',
  }[v.phase];
}

/** "Step 2 of 5" or "Round 1 of 2", for the host's bar and the phones' heading. */
export function progress(v: View): string {
  if (v.step !== undefined && v.steps) return `Step ${v.step + 1} of ${v.steps}`;
  if (v.round && v.rounds) return `Round ${v.round} of ${v.rounds}`;
  return '';
}
