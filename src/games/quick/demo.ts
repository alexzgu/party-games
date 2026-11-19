// Fixed states for screenshots and design review: #/quick?demo=<screen>. Never saved.
import { judge, newGame, reveal, startSteal, timeUp, type GameState } from './logic';

export const DEMO_PROMPTS = ['things you\'d find in a fridge', 'words that rhyme with night', 'things you put on a hot dog', 'excuses for being late', 'kinds of soup'];

/** The game state a demo screen shows, or null for screens outside play. */
export function demoGame(screen: string): GameState | null {
  const base = newGame(['Maya', 'Jordan', 'Priya', 'Sam', 'Theo'], { target: 7, seconds: 5, steal: true, packIds: [] });
  const scored: GameState = { ...base, players: base.players.map((p, i) => ({ ...p, score: [3, 2, 5, 1, 0][i] })), turn: 2, actor: 2 };
  const live = reveal(scored, 'things you put on a hot dog');
  const missed = judge(live, false); // Steal: Sam's turn on Priya's prompt
  switch (screen) {
    case 'handoff-first': return base;
    case 'handoff': return judge(reveal({ ...scored, turn: 1, actor: 1 }, 'kinds of soup'), true);
    case 'handoff-miss': return judge(timeUp({ ...startSteal(missed), timeLeft: 0 }), false);
    case 'live': case 'paused': return { ...live, timeLeft: 2600 };
    case 'judge': return timeUp(live);
    case 'steal': return missed;
    case 'live-steal': return { ...startSteal(missed), timeLeft: 4200 };
    case 'handoff-win': return judge(reveal({ ...scored, players: scored.players.map((p, i) => (i === 2 ? { ...p, score: 6 } : p)) }, 'excuses for being late'), true);
    case 'win': {
      const w = judge(reveal({ ...scored, players: scored.players.map((p, i) => (i === 2 ? { ...p, score: 6 } : p)) }, 'excuses for being late'), true);
      return { ...w, phase: 'win', prev: null, log: Array.from({ length: 17 }, () => w.log[0]) };
    }
    default: return null;
  }
}
