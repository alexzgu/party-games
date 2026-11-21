// Big Board's boards in the shared pack list: a board matches on its name, blurb, categories or clues.
import { customQuiz, type QuizBoard } from '../../lib/content';
import { counted, packTag, type PackEntry } from '../../lib/packList';
import { emptyTiles } from './board';

/** "5 × 5" for a board's size: categories across, clues down. */
export const boardSize = (b: QuizBoard) => `${b.categories.length} × ${b.categories[0]?.clues.length ?? 0}`;

/**
 * A board as the setup's pack list shows it. A search names a category it matches first
 * (`has “Food & Drink”`), else a clue's answer (`has “Avocado”`).
 */
export function boardEntry(b: QuizBoard): PackEntry {
  const clues = b.categories.flatMap((c) => c.clues);
  const empty = emptyTiles(b).length;
  return {
    id: b.id, name: b.name, blurb: b.blurb, added: b.added,
    size: clues.length, sizeLabel: boardSize(b), tag: packTag(b.custom, customQuiz.isEdited(b.id)),
    details: b.categories.map((c) => c.name).join(' · '), warn: empty ? counted(empty, 'empty') : undefined,
    items: [...b.categories.map((c) => ({ label: c.name })), ...clues.map((k) => ({ label: k.answer, text: `${k.answer} ${k.clue}` }))],
  };
}
