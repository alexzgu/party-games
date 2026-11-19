// Fixed states for screenshots and design review: #/quiz?demo=<screen>. Never saved or recorded.
import { quizBoards } from '../../lib/content';
import { newGame, openTile, showAnswer, toggleWrong, type Game, type LogEntry } from './logic';

const PLAYED: LogEntry[] = [
  { kind: 'tile', tile: 0, winner: 0, wrong: [] },
  { kind: 'tile', tile: 5, winner: 1, wrong: [] },
  { kind: 'tile', tile: 6, winner: 2, wrong: [] },
  { kind: 'tile', tile: 10, winner: -1, wrong: [] },
  { kind: 'tile', tile: 16, winner: 0, wrong: [] },
  { kind: 'tile', tile: 21, winner: 1, wrong: [] },
];

/** The game a demo screen shows, or null for setup. */
export function demoGame(screen: string): Game | null {
  const board = quizBoards()[0];
  if (!board) return null;
  const penalty = screen.endsWith('-wrong');
  const base: Game = { ...newGame({ teams: ['Smarty Pants', 'Know-It-Alls', 'Lucky Guesses'], board, double: false, penalty }), log: PLAYED };
  switch (screen) {
    case 'board': return base;
    case 'clue': case 'clue-wrong': return openTile(base, 7);
    case 'answer': return showAnswer(openTile(base, 7));
    case 'answer-wrong': return showAnswer(toggleWrong(openTile(base, 7), 1));
    case 'cleared': {
      const all = Array.from({ length: board.categories.length * base.values.length }, (_, t): LogEntry => ({ kind: 'tile', tile: t, winner: t % 3, wrong: [] }));
      return { ...base, log: all };
    }
    case 'win': return { ...base, phase: 'win' };
    default: return null;
  }
}
