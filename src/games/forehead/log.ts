// Heads Down.'s line in the shared history: one entry per round, rewritten in place when a
// word's mark is fixed on the results screen.
import { record, updateEntry, type HistoryEntry } from '../../lib/history';
import { score, type Round } from './round';
import { selectedDecks } from './state.svelte';

type Fields = Pick<HistoryEntry, 'title' | 'scores' | 'packs' | 'details'>;

function fields(round: Round): Fields {
  const got = score(round.shown);
  return {
    title: `${got} got · ${round.shown.length - got} passed`,
    scores: [{ name: 'Got it', score: got }],
    packs: selectedDecks(round.deckIds).map((d) => d.name),
    details: round.shown.map((s) => `${s.ok ? '✓' : '✗'} ${s.word}`),
  };
}

/**
 * Adds the ended round to the history; returns the entry's id (none for a round with no words).
 * A round stopped from the pause menu is kept but marked unfinished.
 */
export function logRound(round: Round): string | undefined {
  if (round.shown.length === 0) return undefined;
  return record({ game: 'forehead', ...fields(round), finished: round.ended !== 'quit' });
}

/** Rewrites the round's entry after a fix; packs and the finished flag stay as they were. */
export function relogRound(id: string, round: Round): void {
  const { title, scores, details } = fields(round);
  updateEntry(id, { title, scores, details });
}
