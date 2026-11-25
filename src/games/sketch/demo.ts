// Fixed screens for checking the layout: #/sketch/host?demo=<key> and #/sketch/join?demo=<key>;
// on a Draw & guess screen &feed=<n> shows that many guesses instead of the usual four.
import type { Drawing } from '../../lib/ink';
import type { Phase } from './core';
import type { View } from './view';

const lamp = 'demo/lamp';
const cat = 'demo/cat';
export const demoArt: Record<string, Drawing> = {
  [lamp]: [
    { c: 2, w: 15, p: [220, 120, 200, 0, 60, 180, -320, 0, 60, -180] },
    { c: 0, w: 15, p: [320, 300, 0, 220] }, { c: 7, w: 15, p: [220, 540, 200, 0] },
  ],
  [cat]: [
    { c: 0, w: 15, p: [200, 260, 20, -110, 60, 70, 80, 0, 60, -70, 20, 110, 0, 140, -60, 80, -160, 0, -60, -80, 0, -140] },
    { c: 4, w: 15, p: [270, 330] }, { c: 4, w: 15, p: [370, 330] }, { c: 6, w: 5, p: [300, 400, 20, 15, 20, -15] },
  ],
};
const players = [
  { pid: 'a', name: 'Jules', score: 1240 }, { pid: 'b', name: 'Cam', score: 1240 },
  { pid: 'c', name: 'Rae', score: 865 }, { pid: 'd', name: 'Sage', score: 410 },
];
const phases: Phase[] = ['lobby', 'write', 'draw', 'describe', 'album', 'pick', 'guess', 'reveal', 'scores', 'over'];
const alias: Record<string, Phase> = { paused: 'guess', wait: 'draw', watching: 'describe', guessed: 'guess', drawing: 'guess' };
const feed = [
  { pid: 'c', name: 'Rae', text: 'light' }, { pid: 'a', name: 'Jules', text: 'torch' },
  { pid: 'b', name: 'Cam', got: true }, { pid: 'c', name: 'Rae', text: 'lampshade' },
];

function telephone(v: View, key: string, phone: boolean) {
  v.steps = 4;
  v.order = ['a', 'b', 'c', 'd'];
  if (v.phase === 'album') {
    v.album = { chain: 1, chains: 4, entry: 2, starter: 'Cam', end: false, next: cat, items: [
      { kind: 'text', text: 'A lighthouse keeper on holiday', by: 'Cam' },
      { kind: 'drawing', id: lamp, by: 'Rae' },
      { kind: 'text', text: 'A very sad desk lamp', by: 'Sage' },
    ] };
    return;
  }
  v.step = { write: 0, draw: 1, describe: 2 }[v.phase as 'write'];
  v.done = ['b', 'c'];
  v.waiting = 2;
  if (!phone || key === 'watching') return;
  if (key === 'wait') { v.sent = true; v.done = ['a', 'b', 'c']; v.waiting = 1; }
  v.task = { id: 'demo/' + key, kind: v.phase as 'write', ...v.phase === 'draw' ? { line: 'A cat who is late for work' } : v.phase === 'describe' ? { art: lamp } : {} };
}

function guessing(v: View, key: string, phone: boolean, guesses: number | null) {
  v.round = 1;
  v.rounds = 2;
  v.drawer = phone && (key === 'pick' || key === 'drawing') ? 'a' : 'd';
  if (v.phase === 'pick' && phone) v.offer = ['Lamp', 'Fire truck', "Jack-o'-lantern"];
  if (v.phase !== 'guess' && v.phase !== 'reveal') return;
  v.ink = lamp;
  v.feed = guesses === null ? feed : Array.from({ length: guesses }, (_, i) => ({ pid: 'c', name: 'Rae', text: `guess ${i + 1}` }));
  v.got = key === 'guessed' ? ['b', 'a'] : ['b'];
  if (v.phase === 'reveal' || (phone && (key === 'guessed' || key === 'drawing'))) v.word = 'Desk lamp';
  else v.shape = 'D___ _a__';
  if (phone && key === 'guess') v.close = 'desk lamb';
  v.guessing = phone && !v.word;
  v.guessers = 3;
  if (v.phase === 'reveal') v.points = [{ pid: 'b', points: 390 }, { pid: 'd', points: 130 }];
}

export function demo(key: string, phone: boolean, guesses: number | null = null): View {
  const phase = phases.find((p) => p === key) ?? alias[key] ?? 'lobby';
  const mode = ['pick', 'guess', 'reveal', 'scores', 'over'].includes(phase) ? 'guess' : 'telephone';
  const v: View = {
    mode, phase, at: 1, paused: key === 'paused', left: phase === 'lobby' || phase === 'over' || phase === 'album' ? null : 11000,
    total: 45000, packs: ['classic'], players: key === 'watching' ? [...players, { pid: 'e', name: 'Max', score: 0 }] : players,
  };
  if (key === 'watching' && phone) v.players = [{ pid: 'e', name: 'Max', score: 0 }, ...players];
  if (mode === 'telephone' && phase !== 'lobby') telephone(v, key, phone);
  if (mode === 'guess') guessing(v, key, phone, guesses);
  return v;
}
