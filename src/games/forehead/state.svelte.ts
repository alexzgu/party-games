// Heads Down's saved state: setup choices, the round in progress (survives reloads) and the
// scores of this sitting so the group can compare.
import { load, save, remove } from '../../lib/storage';
import { wordDecks, type WordDeck } from '../../lib/content';
import type { Round } from './round';

/** How the holder scores: tilting only, tapping only, or either. */
export type Input = 'tilt' | 'tap' | 'both';

export interface Prefs { deckIds: string[]; seconds: number; input: Input }

/** Phones and tablets get tilt and tap; a laptop has no motion sensor worth trying. */
const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** Saved prefs, with the older `control` choice carried over: its "tilt" always took taps too. */
function loadPrefs(): Prefs {
  const saved = load<Partial<Prefs> & { control?: string }>('forehead:prefs', {});
  const input: Input = saved.input === 'tilt' || saved.input === 'tap' || saved.input === 'both' ? saved.input
    : saved.control === 'tap' ? 'tap' : saved.control === 'tilt' || touch ? 'both' : 'tap';
  return { deckIds: saved.deckIds ?? ['movies'], seconds: saved.seconds ?? 60, input };
}

export const prefs = $state<Prefs>(loadPrefs());
export const savePrefs = () => save('forehead:prefs', $state.snapshot(prefs));

export const game = $state<{ round: Round | null; interrupt: boolean }>({
  round: load<Round | null>('forehead:round', null),
  /** Set when Back was pressed mid-round; the play screen pauses instead of being left. */
  interrupt: false,
});

export function setRound(r: Round | null): void {
  game.round = r;
  if (r) save('forehead:round', r);
  else remove('forehead:round');
}

export interface SessionRound { id: string; score: number; total: number; decks: string }
const SESSION_TTL_MS = 8 * 3600 * 1000;
const savedSession = load('forehead:session', { at: 0, rounds: [] as SessionRound[] });
export const session = $state(Date.now() - savedSession.at < SESSION_TTL_MS ? savedSession : { at: Date.now(), rounds: [] });

/** Adds or updates this round's line in the session scores. */
export function recordScore(entry: SessionRound): void {
  const i = session.rounds.findIndex((r) => r.id === entry.id);
  if (i >= 0) session.rounds[i] = entry;
  else session.rounds.push(entry);
  session.at = Date.now();
  save('forehead:session', $state.snapshot(session));
}

export function clearSession(): void {
  session.rounds = [];
  save('forehead:session', $state.snapshot(session));
}

/** Decks as they are now (custom decks change), keeping only selected ids that still exist. */
export function selectedDecks(ids: readonly string[] = prefs.deckIds): WordDeck[] {
  const all = wordDecks();
  return ids.map((id) => all.find((d) => d.id === id)).filter((d): d is WordDeck => !!d);
}

export function deckLabel(decks: readonly WordDeck[]): string {
  if (decks.length === 0) return 'No pack';
  if (decks.length <= 2) return decks.map((d) => d.name).join(' + ');
  return `${decks[0].name} + ${decks.length - 1} more`;
}
