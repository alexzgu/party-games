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

/** Adds the finished round to the history; returns the entry's id (none for a round with no words). */
export function logRound(round: Round): string | undefined {
  if (round.shown.length === 0) return undefined;
  return record({ game: 'forehead', ...fields(round) });
}

/** Rewrites the round's entry after a fix; packs stay as they were when it was played. */
export function relogRound(id: string, round: Round): void {
  const { title, scores, details } = fields(round);
  updateEntry(id, { title, scores, details });
}
