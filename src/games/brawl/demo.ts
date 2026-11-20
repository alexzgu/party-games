import type { Drawing } from './ink';
import type { Phase, Result } from './logic';
import type { View } from './view';

const rook = { id: 'demo/rook', name: 'The Midnight Rook' };
const toast = { id: 'demo/toast', name: 'Crumb Boss' };
const moth = { id: 'demo/moth', name: 'Porchlight Pete' };
export const demoArt: Record<string, Drawing> = {
  [rook.id]: [
    { c: 4, w: 15, p: [185, 470, 35, -260, 50, 45, 35, -90, 45, 90, 60, -45, 35, 260, -260, 0] },
    { c: 5, w: 15, p: [260, 330] }, { c: 5, w: 15, p: [366, 330] },
    { c: 0, w: 5, p: [275, 390, 40, 26, 40, -26] },
  ],
  [toast.id]: [
    { c: 7, w: 15, p: [190, 470, 0, -185, -35, -35, 10, -45, 70, -45, 175, 0, 55, 45, 10, 45, -35, 35, 0, 185, -250, 0] },
    { c: 2, w: 15, p: [250, 315] }, { c: 2, w: 15, p: [390, 315] },
    { c: 1, w: 15, p: [274, 388, 42, 25, 45, -25] },
  ],
  [moth.id]: [
    { c: 6, w: 15, p: [320, 340, -150, -140, -45, 55, 25, 120, 170, 55, 170, -55, 25, -120, -45, -55, -150, 140] },
    { c: 0, w: 15, p: [320, 190, 0, 275] },
  ],
};
const title = 'First to befriend a ghost';
const result: Result = {
  title, fighters: [rook, toast], artists: ['a', 'b'], votes: [1, 1], points: [1000, 1100], winner: 1, rematch: false,
};
const phases: Phase[] = ['lobby', 'draw', 'challenge', 'title', 'vote', 'payout', 'tag', 'scores', 'over'];

export function demo(key: string, phone: boolean): View {
  const phase = phases.find((p) => p === key) ?? ({
    'lobby-empty': 'lobby', wait: 'draw', late: 'challenge', voted: 'vote', watching: 'vote',
    'tagged': 'tag', rematch: 'vote', paused: 'draw',
  } as const)[key as 'wait'] ?? 'lobby';
  const v: View = {
    phase, at: 1, round: phase === 'tag' || key === 'rematch' || phase === 'over' ? 2 : 1,
    paused: key === 'paused', left: phase === 'lobby' || phase === 'over' ? null : 11000, total: 15000,
    players: key === 'lobby-empty' ? [] : [
      { pid: 'b', name: 'Cam', score: 3300 }, { pid: 'a', name: 'Jules', score: 3300 },
      { pid: 'c', name: 'Rae', score: 2500 }, { pid: 'd', name: 'Sage', score: 1900 },
    ],
  };
  if (phone && (key === 'draw' || key === 'paused' || key === 'challenge')) {
    v.draw = { id: 'demo/' + key, opponent: phase === 'challenge' ? rook : null };
    if (phase === 'draw') v.title = title;
  }
  if (phase === 'draw' || phase === 'challenge') v.progress = ['a', 'b'];
  if (phase === 'title' || phase === 'vote' || phase === 'tag' || phase === 'payout') v.title = title;
  if (phase === 'vote' || phase === 'tag' || phase === 'payout') v.cards = [rook, toast];
  if (phase === 'vote') {
    v.vote = phone && (key === 'vote' || key === 'rematch');
    v.progress = ['c'];
    v.rematch = key === 'rematch';
  }
  if (phase === 'tag') {
    v.title = 'Champion of parking lot karaoke';
    if (phone && key === 'tag') v.options = [moth];
    else { v.picks = [moth, null]; v.progress = ['a']; }
  }
  if (phase === 'payout') v.result = result;
  if (phase === 'over') v.results = [result, { ...result, title: 'Champion of parking lot karaoke', fighters: [moth, toast], winner: 0, rematch: true }];
  return v;
}
