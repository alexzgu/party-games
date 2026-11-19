// Fixed states for screenshots and design review: #/quiz?demo=<screen>&teams=<1–20>. Never saved or recorded.
import { quizBoards } from '../../lib/content';
import { MAX_TEAMS, MIN_TEAMS, newGame, openTile, showAnswer, toggleWrong, type Game, type LogEntry } from './logic';
import { DEFAULT_TEAMS } from './look';

/** A few tiles already played, spread over the teams (solo: some got, some missed). */
const played = (teams: number): LogEntry[] =>
  [0, 5, 6, 10, 16, 21].map((tile, k) => ({ kind: 'tile', tile, winner: teams === 1 ? (k % 3 === 2 ? -1 : 0) : k === 3 ? -1 : (k * 5) % teams, wrong: [] }));

/** The game a demo screen shows, or null for setup. */
export function demoGame(screen: string, teamCount = 3): Game | null {
  const board = quizBoards()[0];
  if (!board) return null;
  const n = Math.min(MAX_TEAMS, Math.max(MIN_TEAMS, Math.round(teamCount)));
  const penalty = screen.endsWith('-wrong');
  const base: Game = { ...newGame({ teams: DEFAULT_TEAMS.slice(0, n), board, double: false, penalty }), log: played(n) };
  switch (screen) {
    case 'board': return base;
    case 'clue': case 'clue-wrong': return openTile(base, 7);
    case 'answer': return showAnswer(openTile(base, 7));
    case 'answer-wrong': return showAnswer(toggleWrong(openTile(base, 7), Math.min(1, n - 1)));
    case 'cleared': {
      const all = Array.from({ length: board.categories.length * base.values.length }, (_, t): LogEntry => ({ kind: 'tile', tile: t, winner: t % n, wrong: [] }));
      return { ...base, log: all };
    }
    case 'win': {
      const all = Array.from({ length: board.categories.length * base.values.length }, (_, t): LogEntry => ({ kind: 'tile', tile: t, winner: n === 1 ? (t % 4 ? 0 : -1) : (t * 7) % n, wrong: [] }));
      return { ...base, log: all, phase: 'win' };
    }
    default: return null;
  }
}
