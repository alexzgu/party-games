// Guess limits, the daily redemption cap and the daily wizard allowance, as pure functions over
// a stored state. The Durable Object in limitsObject.ts keeps the state and applies them one
// request at a time.

/** Change these to loosen or tighten the server. */
export const LIMITS = {
  // An "address" is an IPv4 address or an IPv6 /64 (see address.ts). Every guess counts
  // against its address and against everyone together before it is checked; a right one is
  // given back. When everyone's guesses are used up (a stranger flooding wrong guesses), an
  // address with no guess in the last hour may still try, within the `fresh` allowances, so
  // friends who say the right words are not locked out while guessing stays bounded.
  /** Guesses allowed from one address per window; past it, nothing from there is checked. */
  guessesPerAddress: 10,
  guessAddressWindowMs: 15 * 60_000,
  /** Guesses allowed from everyone together per window (also how long an address's guesses are remembered). */
  guessesEveryone: 300,
  guessEveryoneWindowMs: 60 * 60_000,
  /** Once those are used up: guesses from addresses with none in the last hour, everyone together, per hour... */
  freshEveryone: 100,
  /** ...and from one network (IPv6 /48 or IPv4 /24), per hour. */
  freshPerNetwork: 2,
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
  /** Every guess counted, for the last hour. */
  everyone: number[];
  /** Each address's guesses for the last hour (its limit looks at the last 15 minutes). */
  byAddress: Record<string, number[]>;
  /** Guesses let through by the fresh-address allowance, for the last hour, in all and by network. */
  fresh: number[];
  freshByNetwork: Record<string, number[]>;
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
/** A refusal carries the state unchanged: nothing to store. */
export type Taken<S> = { ok: true; state: S; fresh?: boolean } | { ok: false; state: S; retryAfter: number; scope: Scope };

export const emptyGuesses = (): GuessState => ({ everyone: [], byAddress: {}, fresh: [], freshByNetwork: {} });

const lastHour = (times: number[], now: number) => times.filter((t) => t > now - LIMITS.guessEveryoneWindowMs);

function pruneMap(m: Record<string, number[]>, now: number): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [k, times] of Object.entries(m)) {
    const kept = lastHour(times, now);
    if (kept.length) out[k] = kept;
  }
  return out;
}

/** Drops guesses older than an hour and keys left with none; fills in fields a stored older state lacks. */
function pruneGuesses(s: Partial<GuessState>, now: number): GuessState {
  return {
    everyone: lastHour(s.everyone ?? [], now),
    byAddress: pruneMap(s.byAddress ?? {}, now),
    fresh: lastHour(s.fresh ?? [], now),
    freshByNetwork: pruneMap(s.freshByNetwork ?? {}, now),
  };
}

/** Seconds until fewer than `max` of `times` are inside their window (0 when fewer already). */
export function opensIn(times: number[], max: number, windowMs: number, now: number): number {
  if (times.length < max) return 0;
  const sorted = [...times].sort((a, b) => a - b);
  return Math.max(0, (sorted[times.length - max] + windowMs - now) / 1000);
}

/**
 * When an address refused for everyone's guesses may try again: once everyone's ordinary guesses
 * have room, or once it could take a fresh one (its own guesses this hour, its network's fresh
 * ones and everyone's fresh ones all below their limits), whichever comes first.
 */
function everyoneWait(s: GuessState, mine: number[], net: number[], now: number): { retryAfter: number } {
  const hour = LIMITS.guessEveryoneWindowMs;
  const ordinary = opensIn(s.everyone, LIMITS.guessesEveryone, hour, now);
  const freshAll = opensIn(s.fresh, LIMITS.freshEveryone, hour, now);
  const freshHere = Math.max(opensIn(mine, 1, hour, now), opensIn(net, LIMITS.freshPerNetwork, hour, now), freshAll);
  return { retryAfter: Math.min(ordinary, freshHere) };
}

/**
 * Counts a guess before the phrase is checked, so guesses at the same moment cannot slip past
 * the limit; `refundGuess` takes it back when the phrase was right. An address over its own
 * limit gets nothing. When everyone's guesses are used up, an address with no guess in the
 * last hour still gets one, as long as its network and everyone together have fresh guesses
 * left; `fresh` says it was one of those. `network` defaults to the address itself.
 */
export function takeGuess(state: Partial<GuessState>, address: string, now: number, network = address): Taken<GuessState> {
  const s = pruneGuesses(state, now);
  const mine = s.byAddress[address] ?? [];
  const recent = mine.filter((t) => t > now - LIMITS.guessAddressWindowMs);
  if (recent.length >= LIMITS.guessesPerAddress) return { ok: false, state: s, retryAfter: opensIn(recent, LIMITS.guessesPerAddress, LIMITS.guessAddressWindowMs, now), scope: 'address' };
  const net = s.freshByNetwork[network] ?? [];
  const room = s.everyone.length < LIMITS.guessesEveryone;
  const fresh = !room && mine.length === 0 && net.length < LIMITS.freshPerNetwork && s.fresh.length < LIMITS.freshEveryone;
  if (!room && !fresh) return { ok: false, state: s, ...everyoneWait(s, mine, net, now), scope: 'everyone' };
  return {
    ok: true,
    fresh,
    state: {
      everyone: [...s.everyone, now],
      byAddress: { ...s.byAddress, [address]: [...mine, now] },
      fresh: fresh ? [...s.fresh, now] : s.fresh,
      freshByNetwork: fresh ? { ...s.freshByNetwork, [network]: [...net, now] } : s.freshByNetwork,
    },
  };
}

/** Takes back the guess `takeGuess` counted at `at` for `address` (and, when it was `fresh`, for its network). */
export function refundGuess(state: Partial<GuessState>, address: string, at: number, from: { network: string; fresh: boolean } = { network: address, fresh: false }): GuessState {
  const without = (times: number[]) => {
    const i = times.lastIndexOf(at);
    return i < 0 ? times : [...times.slice(0, i), ...times.slice(i + 1)];
  };
  const dropFrom = (m: Record<string, number[]>, key: string) => {
    const left = without(m[key] ?? []);
    const out = { ...m };
    if (left.length) out[key] = left;
    else delete out[key];
    return out;
  };
  const s = { everyone: state.everyone ?? [], byAddress: state.byAddress ?? {}, fresh: state.fresh ?? [], freshByNetwork: state.freshByNetwork ?? {} };
  return {
    everyone: without(s.everyone),
    byAddress: dropFrom(s.byAddress, address),
    fresh: from.fresh ? without(s.fresh) : s.fresh,
    freshByNetwork: from.fresh ? dropFrom(s.freshByNetwork, from.network) : s.freshByNetwork,
  };
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
