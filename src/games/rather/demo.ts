// Fixed screens for `#/rather/host?demo=<key>` and `#/rather/join?demo=<key>`: every phase without a room.
// The question is the longest built-in one, so the demos show that long choices still fit.
import type { Past, Phase, Tally } from './logic';
import type { View } from './view';

const prompt = 'sit next to a coworker who reheats fish daily or sit next to one who clips their nails at their desk';
const results: Past[] = [
  { prompt: 'be able to fly or be invisible', counts: [3, 2], winner: 0 },
  { prompt: 'always be ten minutes late or always be twenty minutes early', counts: [2, 2], winner: null },
  { prompt, counts: [1, 4], winner: 1 },
];
const tallies: Record<string, Tally> = {
  reveal: { counts: [3, 2], voters: [['a', 'c', 'e'], ['b', 'd']], winner: 0 },
  tie: { counts: [2, 2], voters: [['a', 'c'], ['b', 'd']], winner: null },
};
const phases: Phase[] = ['lobby', 'vote', 'reveal', 'over'];
const aliases: Record<string, Phase> = { 'lobby-empty': 'lobby', wait: 'lobby', voted: 'vote', paused: 'vote', tie: 'reveal' };

export function demo(key: string, phone: boolean): View {
  const phase = phases.find((p) => p === key) ?? aliases[key] ?? 'lobby';
  const over = phase === 'over';
  const v: View = {
    phase, at: 3, n: over ? 10 : 3, count: 10, paused: key === 'paused',
    left: phase === 'vote' ? 14_000 : phase === 'reveal' ? 7_000 : null, total: phase === 'vote' ? 20_000 : 10_000,
    players: key === 'lobby-empty' ? [] : [
      { pid: 'a', name: 'Jules', score: over ? 7 : 2 }, { pid: 'b', name: 'Cam', score: over ? 6 : 2 },
      { pid: 'c', name: 'Rae', score: over ? 6 : 1 }, { pid: 'd', name: 'Sage', score: over ? 4 : 1 }, { pid: 'e', name: 'Theo', score: over ? 3 : 0 },
    ],
  };
  if (over) return { ...v, results };
  if (phase === 'lobby') return v;
  v.prompt = prompt;
  if (phase === 'vote') v.voted = key === 'voted' ? ['a', 'c', 'd'] : ['c', 'd'];
  if (phase === 'reveal') v.tally = tallies[key] ?? tallies.reveal;
  if (phone && (key === 'voted' || phase === 'reveal')) v.mine = 0;
  return v;
}
