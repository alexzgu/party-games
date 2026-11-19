// Fixed states for screenshots and manual checks: #/dial?demo=<screen>. Never linked from the UI.
import { beginRound, callSide, lockIn, markRevealed, newGame, type Game } from './state';
import type { Spectrum } from '../../lib/content';
import { DEFAULT_NAMES } from './look';

const card: Spectrum = { left: 'Underrated', right: 'Overrated' };

const SCREENS = ['handoff', 'handoff-b', 'gate', 'reader', 'team', 'steal', 'reveal', 'revealed', 'win'];

export function demoGame(screen: string): Game | null {
  let g = newGame({ names: DEFAULT_NAMES, goal: 10, steal: true, packIds: ['classic'] });
  g.teams[0].score = 5;
  g.teams[1].score = 3;
  g.roundNo = 4;
  if (!SCREENS.includes(screen)) return null;
  if (screen === 'handoff') return g;
  if (screen === 'handoff-b') return { ...g, active: 1, roundNo: 5 };
  g = beginRound(g, card, 38);
  if (screen === 'gate' || screen === 'reader') return g;
  g = { ...g, phase: 'team', round: { ...g.round!, clue: 'Pineapple on pizza' } };
  if (screen === 'team') return g;
  g = lockIn(g, 41.5);
  if (screen === 'steal') return g;
  g = callSide(g, 'left');
  if (screen === 'reveal') return g;
  g = markRevealed(g);
  if (screen === 'revealed') return g;
  return { ...g, phase: 'win', winner: 0, round: null, roundNo: 9, teams: [{ name: g.teams[0].name, score: 11 }, { name: g.teams[1].name, score: 7 }] };
}

export const demoItems: Spectrum[] = [
  { left: 'Guilty pleasure', right: 'Proud pleasure' },
  { left: 'Forgettable song', right: 'Stuck in your head' },
  { left: 'One-hit wonder', right: 'Legend' },
  { left: 'Elevator music', right: 'Mosh pit' },
  { left: 'Karaoke disaster', right: 'Karaoke classic' },
];
