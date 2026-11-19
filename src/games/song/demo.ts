// Fixed states for screenshots and design review: #/song?demo=<screen>. Never saved, no YouTube.
import type { Song } from '../../lib/content';
import type { ClipStatus } from './clip';
import { newGame, type GameState } from './logic';

const SONGS: Song[] = [
  { title: 'Mr. Brightside', artist: 'The Killers', youtube: 'gGdGFtwCNBE', start: 66 },
  { title: 'Single Ladies (Put a Ring on It)', artist: 'Beyoncé', youtube: '4m1EFMoRFvY', start: 16 },
];

/** The game state and player status a demo screen shows, or null for screens outside play. */
export function demoGame(screen: string): { game: GameState; status: ClipStatus } | null {
  const base = newGame(['Maya', 'Jordan', 'Priya', 'Sam', 'Theo'], { target: 10, packIds: [] }, SONGS[0]);
  const scored: GameState = { ...base, players: base.players.map((p, i) => ({ ...p, score: [6, 3, 8, 1, 0][i] })), songsPlayed: 9 };
  const at = (game: GameState, status: ClipStatus = 'cued') => ({ game, status });
  switch (screen) {
    case 'ready-first': return at(base);
    case 'ready': case 'ready-offline': return at(scored);
    case 'listen': return at({ ...scored, phase: 'listen' }, 'playing');
    case 'listen-longer': return at({ ...scored, phase: 'listen', step: 2 }, 'done');
    case 'listen-ad': return at({ ...scored, phase: 'listen' }, 'ad');
    case 'listen-tap': return at({ ...scored, phase: 'listen' }, 'blocked');
    case 'listen-crowd': {
      const crowd = newGame(['Alexandra', 'Ben', 'Chloé', 'Dev', 'Esmeralda', 'Finn', 'Grace', 'Hiro', 'Isabella', 'Jo'], { target: 10, packIds: [] }, SONGS[0]);
      return at({ ...crowd, phase: 'listen', step: 1 }, 'playing');
    }
    case 'reveal': return at({ ...scored, players: scored.players.map((p, i) => (i === 0 ? { ...p, score: 9 } : p)), phase: 'reveal', song: SONGS[1], outcome: { kind: 'point', scorer: 0, points: 3 } }, 'payoff');
    case 'reveal-nobody': return at({ ...scored, phase: 'reveal', step: 2, outcome: { kind: 'nobody' } }, 'done');
    case 'scores': return at({ ...scored, phase: 'scores', outcome: { kind: 'point', scorer: 2, points: 2 } });
    case 'win': return at({ ...scored, players: scored.players.map((p, i) => (i === 2 ? { ...p, score: 10 } : p)), phase: 'win', songsPlayed: 14 });
    default: return null;
  }
}
