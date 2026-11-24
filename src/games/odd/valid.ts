// Reading Odd One Out's saved game and setup back defensively: a damaged save falls back to
// setup (or to the defaults) instead of breaking the app on every reload.
import { MAX_PLAYERS, MIN_PLAYERS, ROUNDS_RANGE, type GameState, type Phase, type Round } from './logic';

const PHASES: Phase[] = ['pass', 'clues', 'vote', 'reveal', 'scores', 'win'];
const int = (x: unknown, min: number, max: number): x is number => Number.isInteger(x) && (x as number) >= min && (x as number) <= max;
const strings = (x: unknown): x is string[] => Array.isArray(x) && x.every((v) => typeof v === 'string');
const word = (x: unknown): x is string => typeof x === 'string' && x.trim() !== '';

function validRound(x: unknown, n: number): Round | null {
  const r = x as Round | null;
  if (!r || typeof r !== 'object' || !word(r.word) || typeof r.pack !== 'string') return null;
  if (!int(r.odd, 0, n - 1) || !int(r.starter, 0, n - 1) || !int(r.picked, -1, n - 1)) return null;
  if (typeof r.shown !== 'boolean' || (r.guessed !== null && typeof r.guessed !== 'boolean')) return null;
  return r;
}

/** The room's pick fits the phase: nobody before the vote, a seat from the reveal on. */
const pickFits = (phase: Phase, picked: number) => (phase === 'pass' || phase === 'clues' || phase === 'vote' ? picked === -1 : picked >= 0);

/** A saved game from localStorage, or null if missing or not the shape this version writes. */
export function validGame(x: unknown): GameState | null {
  const s = x as GameState | null;
  if (!s || typeof s !== 'object' || s.v !== 1 || !Array.isArray(s.players)) return null;
  const n = s.players.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS || !s.players.every((p) => typeof p?.name === 'string' && int(p.score, 0, 10_000))) return null;
  if (!PHASES.includes(s.phase) || !int(s.seat, 0, n - 1) || !int(s.rounds, ROUNDS_RANGE[0], ROUNDS_RANGE[1])) return null;
  if (typeof s.hint !== 'boolean' || typeof s.oddNeverStarts !== 'boolean' || !strings(s.packIds) || !strings(s.used)) return null;
  const round = validRound(s.round, n);
  const log = Array.isArray(s.log) ? s.log.map((r) => validRound(r, n)) : [null];
  if (!round || log.some((r) => !r || r.picked < 0) || log.length > s.rounds) return null;
  if ((s.phase === 'win') !== (log.length === s.rounds)) return null;
  if (!pickFits(s.phase, round.picked) || ((s.phase === 'scores' || s.phase === 'win') && log.length === 0)) return null;
  return { ...s, round, log: log as Round[] };
}

export interface SetupPrefs { packIds: string[] | null; rounds: number; hint: boolean; oddNeverStarts: boolean }
export const DEFAULT_SETUP: SetupPrefs = { packIds: null, rounds: 5, hint: true, oddNeverStarts: true };

/** Saved setup choices, each field checked on its own and replaced by its default if bad. */
export function validSetup(x: unknown): SetupPrefs {
  const p = (x && typeof x === 'object' ? x : {}) as Partial<SetupPrefs>;
  return {
    packIds: strings(p.packIds) ? p.packIds : DEFAULT_SETUP.packIds,
    rounds: int(p.rounds, ROUNDS_RANGE[0], ROUNDS_RANGE[1]) ? p.rounds : DEFAULT_SETUP.rounds,
    hint: typeof p.hint === 'boolean' ? p.hint : DEFAULT_SETUP.hint,
    oddNeverStarts: typeof p.oddNeverStarts === 'boolean' ? p.oddNeverStarts : DEFAULT_SETUP.oddNeverStarts,
  };
}
