// Fixed states for screenshots and design review: #/gibberish?demo=<screen>. Never saved.
import type { GibberishCard } from '../../lib/content';
import { newGame, type GameState } from './logic';

export const DEMO_CARDS: GibberishCard[] = [
  { phrase: 'Hair Eye Pot Her', answer: 'Harry Potter', hint: 'Character' },
  { phrase: 'Eye Scream', answer: 'Ice Cream', hint: 'Food' },
  { phrase: 'Sand A Claws', answer: 'Santa Claus', hint: 'Holiday' },
  { phrase: 'Bee Yawn Say', answer: 'Beyoncé', hint: 'Singer' },
  { phrase: 'Sigh Ants Fig Shun', answer: 'Science Fiction', hint: 'Genre' },
];

/** The game state a demo screen shows, or null for screens outside play. */
export function demoGame(screen: string): GameState | null {
  const base = newGame(['Maya', 'Jordan', 'Priya', 'Sam', 'Theo'], { target: 5, seconds: 30, packIds: [] });
  const scored: GameState = { ...base, players: base.players.map((p, i) => ({ ...p, score: [3, 2, 4, 1, 0][i] })), cardsPlayed: 9, reader: 2 };
  const card = DEMO_CARDS[0];
  switch (screen) {
    case 'handoff-first': return base;
    case 'handoff': return { ...scored, phase: 'handoff' };
    case 'card-crowd': {
      const crowd = newGame(['Alexandra', 'Ben', 'Chloé', 'Dev', 'Esmeralda', 'Finn', 'Grace', 'Hiro', 'Isabella', 'Jo', 'Kwame', 'Lu'], { target: 5, seconds: 45, packIds: [] });
      return { ...crowd, phase: 'card', card: DEMO_CARDS[4], reader: 3 };
    }
    case 'card': case 'card-category': case 'card-peek': return { ...scored, phase: 'card', card, timeLeft: 7400 };
    case 'paused': return { ...scored, phase: 'card', card, timeLeft: 21000 };
    case 'reveal': return { ...scored, players: scored.players.map((p, i) => (i === 0 ? { ...p, score: 4 } : p)), phase: 'reveal', card, outcome: { kind: 'point', scorer: 0 } };
    case 'reveal-nobody': return { ...scored, phase: 'reveal', card: DEMO_CARDS[4], outcome: { kind: 'timeout' }, timeLeft: 0 };
    case 'win': return { ...scored, players: scored.players.map((p, i) => (i === 2 ? { ...p, score: 5 } : p)), phase: 'win', card, cardsPlayed: 14 };
    default: return null;
  }
}
