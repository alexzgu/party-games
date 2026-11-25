// "Ask for changes" on the Big Board Fizzwick just wrote, in its editor until it is saved: he
// writes the whole board again at its size as it stands, keeping what fits (generate.ts,
// `boardChange`). While he writes, the new board is only shown (`show`); the stored unsaved board
// (`store`) stays the whole board from before until the change has finished, so a reload
// mid-change finds it untouched. The board's name follows every pack name's rule (PackName).
import type { QuizBoard } from '../../lib/content';
import { afterRun } from '../../lib/library';
import { viaPass } from '../../lib/claude';
import { PackName, type NameSnapshot } from '../../lib/packName.svelte';
import { Changes } from '../../lib/wizardChanges.svelte';
import { boardChange, boardClues } from './generate';
import type { StreamClue } from './parse';

export type BoardReview = { board: QuizBoard; tab: number; name: NameSnapshot };

export interface BoardScreen {
  /** What Fizzwick was asked for the board. */
  request: string;
  board: () => QuizBoard | null;
  /** Puts a board on screen only. */
  show: (b: QuizBoard) => void;
  /** Writes the unsaved board to storage. */
  store: (b: QuizBoard) => void;
  tab: () => number;
  setTab: (i: number) => void;
  name: PackName;
  /** Each clue as it lands (a tick). */
  onItem?: () => void;
}

/** A board's tiles emptied, its category names kept until new ones come. */
const emptied = (b: QuizBoard): QuizBoard => ({ ...b, categories: b.categories.map((c) => ({ ...c, clues: c.clues.map(() => ({ clue: '', answer: '' })) })) });

export function boardChanges(s: BoardScreen): Changes<StreamClue, StreamClue, BoardReview> {
  let place = (b: QuizBoard, _: StreamClue) => b;
  let size = 0;
  const withName = (b: QuizBoard): QuizBoard => ({ ...b, name: s.name.value });
  return new Changes<StreamClue, StreamClue, BoardReview>({
    game: (r) => {
      const c = boardChange(r.board, () => s.board() ?? r.board);
      place = c.place;
      size = c.game.max;
      return c.game;
    },
    request: () => s.request, asked: () => size, avoid: () => [],
    name: () => s.name, running: () => false,
    save: () => ({ board: s.board()!, tab: s.tab(), name: s.name.snapshot() }),
    restore: (r) => {
      s.name.restore(r.name);
      const b = withName(r.board);
      s.show(b);
      s.store(b);
      s.setTab(r.tab);
    },
    parts: (r) => ({ kept: boardClues(r.board), removed: [] }),
    // Any change by hand but the name ends the Undo step.
    edited: (r) => { const b = s.board(); return !!b && (b.categories !== r.board.categories || b.blurb !== r.board.blurb); },
    // The share mark holds only through a pass.
    clear: () => { const b = s.board(); if (b) s.show(afterRun(emptied(b), viaPass(), false)); },
    add: (t) => { const b = s.board(); if (b) s.show(withName(place(b, t))); s.onItem?.(); },
    items: () => { const b = s.board(); return b ? boardClues(b) : []; },
    onDone: () => { const b = s.board(); if (b) { const named = withName(b); s.show(named); s.store(named); } },
  });
}
