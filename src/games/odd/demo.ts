// Fixed states for screenshots and design review: #/odd?demo=<screen>. Never saved.
// handoff · secret · secret-odd · secret-odd-nohint · clues · vote · reveal-caught · reveal-word ·
// reveal-escaped · scores · win
import { hide, newGame, settle, showWord, toVote, vote, type GameState } from './logic';

const NAMES = ['Maya', 'Jordan', 'Priya', 'Sam', 'Theo'];

/** The game state a demo screen shows, or null for screens outside play. */
export function demoGame(screen: string): GameState | null {
  const base = newGame(NAMES, { rounds: 5, hint: !screen.endsWith('nohint'), oddNeverStarts: true, packIds: [] }, { word: 'Pizza', pack: 'Food & Drink' });
  const g: GameState = { ...base, round: { ...base.round, odd: 2, starter: 3 } };
  const onPriya = hide(hide(g)); // Priya's hand-off: she is the odd one out
  const voting = toVote({ ...g, phase: 'clues' });
  const scored = (s: GameState) => ({ ...s, players: s.players.map((p, i) => ({ ...p, score: p.score + [3, 1, 4, 2, 0][i] })) });
  switch (screen) {
    case 'handoff': return hide(g);
    case 'secret': return hide(g);
    case 'secret-odd': case 'secret-odd-nohint': return onPriya;
    case 'clues': return { ...g, phase: 'clues' };
    case 'vote': return voting;
    case 'reveal-caught': return vote(voting, 2);
    case 'reveal-word': return showWord(vote(voting, 2));
    case 'reveal-escaped': return vote(voting, 0);
    case 'scores': return settle(vote(scored(voting), 0), null);
    case 'win': {
      const last = settle(showWord(vote(scored({ ...voting, rounds: 3, log: [g.round, g.round] }), 2)), false);
      return last;
    }
    default: return null;
  }
}
