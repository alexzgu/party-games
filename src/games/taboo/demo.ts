// Fixed states for screenshots and manual checks: #/taboo?demo=<screen>. Never linked from the UI.
import type { TabooCard } from '../../lib/content';
import { DEFAULT_NAMES } from './look';
import { finishTurn, markCard, newGame, nextTurn, startTurn, tick, timeUp, type Game } from './state';

const CARDS: TabooCard[] = [
  { word: 'Pizza', banned: ['Cheese', 'Slice', 'Pepperoni', 'Italian', 'Delivery'] },
  { word: 'Karaoke', banned: ['Sing', 'Microphone', 'Song', 'Bar', 'Lyrics'] },
  { word: 'Jet lag', banned: ['Tired', 'Time zone', 'Flight', 'Travel', 'Sleep'] },
  { word: 'Fortune cookie', banned: ['Chinese', 'Message', 'Paper', 'Crack', 'Future'] },
  { word: 'Snowman', banned: ['Carrot', 'Winter', 'Frosty', 'Build', 'Melt'] },
];

export const SCREENS = ['handoff', 'turn', 'turn-late', 'summary', 'scores', 'win'] as const;

/** One finished turn per team (3–2 to the first team), then the screen asked for. */
export function demoGame(screen: string): Game | null {
  if (!(SCREENS as readonly string[]).includes(screen)) return null;
  let g = newGame({ names: DEFAULT_NAMES, seconds: 60, mode: 'score', goal: 15, rounds: 5, skipCost: false, packIds: ['classic'] });
  const turn = (marks: ('got' | 'skip' | 'buzz')[]) => {
    g = startTurn(g, CARDS[0]);
    marks.forEach((m, i) => (g = markCard(g, m, CARDS[(i + 1) % CARDS.length])));
  };
  turn(['got', 'got', 'skip', 'got']);
  g = nextTurn(finishTurn(timeUp(g)));
  turn(['got', 'buzz', 'got', 'got']);
  g = nextTurn(finishTurn(timeUp(g)));
  if (screen === 'handoff') return g;
  turn(['got', 'skip']);
  g = tick(g, screen === 'turn-late' ? 7400 : 41000);
  if (screen.startsWith('turn')) return g;
  g = markCard(g, 'buzz', CARDS[4]);
  g = timeUp(g);
  if (screen === 'summary') return g;
  g = finishTurn(g);
  if (screen === 'scores') return g;
  return { ...g, phase: 'win', winner: 0 };
}
