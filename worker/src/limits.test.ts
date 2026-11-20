import { describe, expect, it } from 'vitest';
import { emptyGuesses, LIMITS, refundBudget, refundGuess, takeBudget, takeGuess, takeRedeem, untilTomorrow, type BudgetState, type GuessState, type RedeemState } from './limits';

const T0 = Date.UTC(2026, 10, 20, 12);

function guesses(state: GuessState, address: string, n: number, now = T0) {
  let s = state;
  const results = [];
  for (let i = 0; i < n; i++) {
    const r = takeGuess(s, address, now);
    s = r.state;
    results.push(r);
  }
  return { state: s, results };
}

describe('guess limits', () => {
  it('stops an address after its limit until the window passes', () => {
    const { state, results } = guesses(emptyGuesses(), 'a', LIMITS.guessesPerAddress + 1);
    expect(results.slice(0, -1).every((r) => r.ok)).toBe(true);
    const last = results.at(-1)!;
    expect(last.ok).toBe(false);
    if (!last.ok) expect([last.scope, last.retryAfter]).toEqual(['address', LIMITS.guessAddressWindowMs / 1000]);
    expect(takeGuess(state, 'a', T0 + LIMITS.guessAddressWindowMs + 1).ok).toBe(true);
    expect(takeGuess(state, 'b', T0).ok).toBe(true);
  });
  it('stops everyone together after the global limit', () => {
    let s = emptyGuesses();
    for (let i = 0; i < LIMITS.guessesEveryone; i++) s = guesses(s, `addr${i}`, 1).state;
    const r = takeGuess(s, 'fresh', T0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.scope).toBe('everyone');
    const later = takeGuess(s, 'fresh', T0 + LIMITS.guessAddressWindowMs + 1);
    expect(later.ok).toBe(false); // the addresses have aged out, the hour has not
    expect(later.state.byAddress).toEqual({});
    expect(takeGuess(s, 'fresh', T0 + LIMITS.guessEveryoneWindowMs + 1).ok).toBe(true);
  });
  it('takes back a right guess', () => {
    const { state } = guesses(emptyGuesses(), 'a', 1);
    expect(refundGuess(state, 'a', T0)).toEqual(emptyGuesses());
    expect(refundGuess(state, 'a', T0 + 1)).toEqual(state);
  });
});

describe('daily allowance', () => {
  it('reserves per session and for everyone, starting over each UTC day', () => {
    let s: BudgetState | undefined;
    for (let i = 0; i < LIMITS.requestsPerSessionPerDay; i++) {
      const r = takeBudget(s, 'one', T0);
      expect(r.ok).toBe(true);
      s = r.state;
    }
    const over = takeBudget(s, 'one', T0);
    expect(over.ok).toBe(false);
    if (!over.ok) expect([over.scope, over.retryAfter]).toEqual(['session', 12 * 3600]);
    expect(takeBudget(s, 'two', T0).ok).toBe(true);
    expect(takeBudget(s, 'one', T0 + 12 * 3600_000).ok).toBe(true);
  });
  it('stops everyone at the daily total', () => {
    const full: BudgetState = { day: '2026-11-20', total: LIMITS.requestsPerDay, bySession: {} };
    const r = takeBudget(full, 'new', T0);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.scope).toBe('party');
  });
  it('gives back a reservation the same day only', () => {
    const taken = takeBudget(undefined, 'one', T0).state;
    expect(refundBudget(taken, 'one', '2026-11-20', T0)).toEqual({ day: '2026-11-20', total: 0, bySession: { one: 0 } });
    expect(refundBudget(taken, 'two', '2026-11-20', T0)).toEqual(taken);
    expect(untilTomorrow(T0)).toBe(12 * 3600);
  });
  it("doesn't let yesterday's refund erase today's reservation", () => {
    const midnight = Date.UTC(2026, 10, 21);
    const yesterday = takeBudget(undefined, 'one', midnight - 1000).state;
    const today = takeBudget(yesterday, 'one', midnight + 1000).state;
    expect(today).toEqual({ day: '2026-11-21', total: 1, bySession: { one: 1 } });
    expect(refundBudget(today, 'one', '2026-11-20', midnight + 2000)).toEqual(today);
    expect(refundBudget(today, 'one', '2026-11-21', midnight + 2000)).toEqual({ day: '2026-11-21', total: 0, bySession: { one: 0 } });
  });
});

describe('redemptions per address', () => {
  it('cap right phrases from one address per UTC day', () => {
    let s: RedeemState | undefined;
    for (let i = 0; i < LIMITS.redeemsPerAddressPerDay; i++) {
      const r = takeRedeem(s, 'a', T0);
      expect(r.ok).toBe(true);
      s = r.state;
    }
    const over = takeRedeem(s, 'a', T0);
    expect(over.ok).toBe(false);
    if (!over.ok) expect([over.scope, over.retryAfter]).toEqual(['redeems', 12 * 3600]);
    expect(takeRedeem(s, 'b', T0).ok).toBe(true);
    expect(takeRedeem(s, 'a', T0 + 12 * 3600_000).ok).toBe(true);
  });
});
