// Guess limits, the daily redemption cap and the daily wizard allowance, as pure functions over
// a stored state. The Durable Object in limitsObject.ts keeps the state and applies them one
// request at a time.

/** Change these to loosen or tighten the server. */
export const LIMITS = {
  // Guesses are counted before they are checked, so strangers' wrong guesses also slow friends
  // down: these are set high enough that a lockout takes effort, and low enough that guessing
  // a phrase of 3 dice words (about 39 bits) still takes centuries.
  /** Wrong phrase guesses allowed from one address per window. */
  guessesPerAddress: 10,
  guessAddressWindowMs: 15 * 60_000,
  /** Wrong phrase guesses allowed from everyone together per window. */
  guessesEveryone: 300,
  guessEveryoneWindowMs: 60 * 60_000,
  /**
   * Right phrases accepted from one address per UTC day. Each one starts a fresh pass with its
   * own per-pass allowance, so this stops a script minting passes without end. A party on one
   * Wi-Fi shares an address, hence room for a crowd.
   */
  redeemsPerAddressPerDay: 20,
  /** Wizard requests forwarded per UTC day, everyone together: the real cap. */
  requestsPerDay: 300,
  /**
   * Wizard requests forwarded per UTC day for one pass. A soft cap: saying the words again
   * gives a new pass (within `redeemsPerAddressPerDay`), so `requestsPerDay` is what binds.
   */
  requestsPerSessionPerDay: 60,
};

export interface GuessState {
  everyone: number[];
  byAddress: Record<string, number[]>;
}

export interface BudgetState {
  day: string;
  total: number;
  bySession: Record<string, number>;
}

export interface RedeemState {
  day: string;
  byAddress: Record<string, number>;
}

export type Scope = 'address' | 'everyone' | 'redeems' | 'session' | 'party';
export type Taken<S> = { ok: true; state: S } | { ok: false; state: S; retryAfter: number; scope: Scope };

export const emptyGuesses = (): GuessState => ({ everyone: [], byAddress: {} });

/** Drops guesses older than their window and addresses left with none. */
function pruneGuesses(s: GuessState, now: number): GuessState {
  const byAddress: Record<string, number[]> = {};
  for (const [a, times] of Object.entries(s.byAddress)) {
    const kept = times.filter((t) => t > now - LIMITS.guessAddressWindowMs);
    if (kept.length) byAddress[a] = kept;
  }
  return { everyone: s.everyone.filter((t) => t > now - LIMITS.guessEveryoneWindowMs), byAddress };
}

/** Seconds until the oldest of `times` leaves its window. */
const wait = (times: number[], windowMs: number, now: number) => (Math.min(...times) + windowMs - now) / 1000;

/**
 * Counts a guess before the phrase is checked, so guesses at the same moment cannot slip past
 * the limit; `refundGuess` takes it back when the phrase was right.
 */
export function takeGuess(state: GuessState, address: string, now: number): Taken<GuessState> {
  const s = pruneGuesses(state, now);
  const mine = s.byAddress[address] ?? [];
  if (mine.length >= LIMITS.guessesPerAddress) return { ok: false, state: s, retryAfter: wait(mine, LIMITS.guessAddressWindowMs, now), scope: 'address' };
  if (s.everyone.length >= LIMITS.guessesEveryone) return { ok: false, state: s, retryAfter: wait(s.everyone, LIMITS.guessEveryoneWindowMs, now), scope: 'everyone' };
  return { ok: true, state: { everyone: [...s.everyone, now], byAddress: { ...s.byAddress, [address]: [...mine, now] } } };
}

/** Takes back the guess `takeGuess` counted at `at` for `address`. */
export function refundGuess(state: GuessState, address: string, at: number): GuessState {
  const without = (times: number[]) => {
    const i = times.lastIndexOf(at);
    return i < 0 ? times : [...times.slice(0, i), ...times.slice(i + 1)];
  };
  const mine = without(state.byAddress[address] ?? []);
  const byAddress = { ...state.byAddress };
  if (mine.length) byAddress[address] = mine;
  else delete byAddress[address];
  return { everyone: without(state.everyone), byAddress };
}

export const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10);

/** Seconds to the next UTC midnight, when the allowance starts again. */
export const untilTomorrow = (now: number) => (86_400_000 - (now % 86_400_000)) / 1000;

const today = (state: BudgetState | undefined, now: number): BudgetState =>
  state && state.day === utcDay(now) ? state : { day: utcDay(now), total: 0, bySession: {} };

/** Counts a right phrase from `address`; refused past the daily cap. */
export function takeRedeem(state: RedeemState | undefined, address: string, now: number): Taken<RedeemState> {
  const s = state && state.day === utcDay(now) ? state : { day: utcDay(now), byAddress: {} };
  const mine = s.byAddress[address] ?? 0;
  if (mine >= LIMITS.redeemsPerAddressPerDay) return { ok: false, state: s, retryAfter: untilTomorrow(now), scope: 'redeems' };
  return { ok: true, state: { day: s.day, byAddress: { ...s.byAddress, [address]: mine + 1 } } };
}

/** Reserves one forwarded request for `session` before it is sent. */
export function takeBudget(state: BudgetState | undefined, session: string, now: number): Taken<BudgetState> {
  const s = today(state, now);
  const mine = s.bySession[session] ?? 0;
  if (s.total >= LIMITS.requestsPerDay) return { ok: false, state: s, retryAfter: untilTomorrow(now), scope: 'party' };
  if (mine >= LIMITS.requestsPerSessionPerDay) return { ok: false, state: s, retryAfter: untilTomorrow(now), scope: 'session' };
  return { ok: true, state: { day: s.day, total: s.total + 1, bySession: { ...s.bySession, [session]: mine + 1 } } };
}

/**
 * Gives a reservation back (the API refused the request, so it cost nothing). `day` is the UTC
 * day it was reserved on: a refund arriving after midnight leaves the new day's counts alone.
 */
export function refundBudget(state: BudgetState | undefined, session: string, day: string, now: number): BudgetState {
  const s = today(state, now);
  const mine = s.bySession[session] ?? 0;
  if (s.day !== day || mine <= 0 || s.total <= 0) return s;
  return { day: s.day, total: s.total - 1, bySession: { ...s.bySession, [session]: mine - 1 } };
}
