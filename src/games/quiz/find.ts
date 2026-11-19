// Search and sort for the board list: a board matches on its name, blurb, categories or clues.
import { packAge, type QuizBoard } from '../../lib/content';
import { matches, sorted, type SortKey } from '../../lib/listing';

/**
 * Whether a board matches, and, when only its insides do, a short line saying what
 * (`has “Avocado”`, `has “Food & Drink”`). Empty `hit` when the name or blurb matches.
 */
export function boardHit(b: QuizBoard, query: string): { match: boolean; hit: string } {
  if (matches(b.name, query) || matches(b.blurb, query)) return { match: true, hit: '' };
  const cat = b.categories.find((c) => matches(c.name, query));
  if (cat) return { match: true, hit: `has “${cat.name}”` };
  const found = b.categories.flatMap((c) => c.clues).filter((k) => matches(k.answer, query) || matches(k.clue, query));
  if (!found.length) return { match: false, hit: '' };
  const first = found.find((k) => matches(k.answer, query)) ?? found[0];
  const more = found.length - 1;
  return { match: true, hit: `has “${first.answer}”${more ? ` and ${more} more` : ''}` };
}

/** The boards to show, in the chosen order, each with its hit line. */
export function findBoards(boards: QuizBoard[], query: string, sort: SortKey) {
  const found = boards.map((b) => ({ b, ...boardHit(b, query) })).filter((x) => x.match);
  return sorted(found, sort, (x) => x.b.name, (x) => packAge(x.b));
}

/** "5 × 5" for a board's size: categories across, clues down. */
export const boardSize = (b: QuizBoard) => `${b.categories.length} × ${b.categories[0]?.clues.length ?? 0}`;
