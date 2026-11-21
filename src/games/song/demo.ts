// Fixed states for screenshots and design review: #/song?demo=<screen>. Never saved, no network.
import type { Song } from '../../lib/content';
import type { Track } from './match';
import type { ClipStatus } from './ui';
import { newGame, type GameState } from './logic';

const SONGS: Song[] = [
  { title: 'Mr. Brightside', artist: 'The Killers', apple: 1526194192, youtube: 'gGdGFtwCNBE' },
  { title: 'Single Ladies (Put a Ring on It)', artist: 'Beyoncé', apple: 1440802400 },
];

/** Stand-in album art (no network in demos). */
const ART = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="#ff5fa2"/><stop offset="1" stop-color="#5b3df5"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><circle cx="50" cy="50" r="30" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="3"/><circle cx="50" cy="50" r="6" fill="#fff"/></svg>');

const track = (s: Song): Track => ({
  id: s.apple ?? 0, title: s.title, artist: s.artist, album: '', artwork: ART, preview: '', released: '',
  link: `https://music.apple.com/us/song/${s.apple}`,
});

/** The game state, clip status and track a demo screen shows, or null for screens outside play. */
export function demoGame(screen: string): { game: GameState; status: ClipStatus; track: Track | null } | null {
  const base = newGame(['Maya', 'Jordan', 'Priya', 'Sam', 'Theo'], { target: 10, packIds: [] }, SONGS[0]);
  const scored: GameState = { ...base, players: base.players.map((p, i) => ({ ...p, score: [6, 3, 8, 1, 0][i] })), songsPlayed: 9 };
  const at = (game: GameState, status: ClipStatus = 'ready') => ({ game, status, track: game.song ? track(game.song) : null });
  switch (screen) {
    case 'ready-first': return at(base);
    case 'ready': case 'ready-offline': return at(scored);
    case 'listen': return at({ ...scored, phase: 'listen' }, 'playing');
    case 'listen-longer': return at({ ...scored, phase: 'listen', step: 2 }, 'done');
    case 'listen-tap': return at({ ...scored, phase: 'listen' }, 'blocked');
    case 'listen-crowd': {
      const crowd = newGame(['Alexandra', 'Ben', 'Chloé', 'Dev', 'Esmeralda', 'Finn', 'Grace', 'Hiro', 'Isabella', 'Jo'], { target: 10, packIds: [] }, SONGS[0]);
      return at({ ...crowd, phase: 'listen', step: 1 }, 'playing');
    }
    case 'reveal': return at({ ...scored, players: scored.players.map((p, i) => (i === 0 ? { ...p, score: 9 } : p)), phase: 'reveal', song: SONGS[1], outcome: { kind: 'point', scorer: 0, points: 3 } }, 'done');
    case 'reveal-video': return at({ ...scored, phase: 'reveal', step: 1, outcome: { kind: 'point', scorer: 2, points: 2 } }, 'done');
    case 'reveal-nobody': return at({ ...scored, phase: 'reveal', step: 2, song: SONGS[1], outcome: { kind: 'nobody' } }, 'done');
    case 'scores': return at({ ...scored, phase: 'scores', outcome: { kind: 'point', scorer: 2, points: 2 } });
    case 'win': return at({ ...scored, players: scored.players.map((p, i) => (i === 2 ? { ...p, score: 10 } : p)), phase: 'win', songsPlayed: 14 });
    default: return null;
  }
}
