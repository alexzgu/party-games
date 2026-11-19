// Pure round logic: what was shown, the score, fixing mis-tilts, and dealing words.
import { makeBag } from '../../lib/bag';
import type { WordDeck } from '../../lib/content';

export interface Shown { word: string; ok: boolean }
export type Phase = 'ready' | 'play' | 'results';
export type EndReason = 'time' | 'out' | 'quit';

export interface Round {
  id: string;
  deckIds: string[];
  seconds: number;
  tilt: boolean;
  shown: Shown[];
  /** The word on screen right now (not yet in `shown`). */
  current: string | null;
  remainingMs: number;
  phase: Phase;
  ended?: EndReason;
  /** This round's entry in the shared history, rewritten when a mark is fixed. */
  logId?: string;
}

export const ROUND_LENGTHS = [30, 60, 90, 120] as const;

export function newRound(deckIds: string[], seconds: number, tilt: boolean): Round {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    deckIds, seconds, tilt, shown: [], current: null, remainingMs: seconds * 1000, phase: 'ready',
  };
}

export const score = (shown: readonly Shown[]): number => shown.filter((s) => s.ok).length;

/** Flips one result, for fixing a mis-tilt on the results screen. */
export const toggle = (shown: readonly Shown[], i: number): Shown[] =>
  shown.map((s, j) => (j === i ? { ...s, ok: !s.ok } : s));

/** Records the word on screen and moves to the next one. */
export function mark(round: Round, ok: boolean, next: string | null): Round {
  const shown = round.current ? [...round.shown, { word: round.current, ok }] : round.shown;
  return { ...round, shown, current: next };
}

/**
 * Puts the first word on screen when play opens. `out` is true when there is nothing to
 * deal (empty or deleted decks): the round must end right away instead of waiting forever.
 */
export function openPlay(round: Round, next: () => string | undefined): { round: Round; out: boolean } {
  if (round.current) return { round, out: false };
  const first = next();
  return first ? { round: { ...round, current: first }, out: false } : { round, out: true };
}

/** Ends the round; the word left on screen counts as a pass (fixable on the results screen). */
export function finish(round: Round, reason: EndReason): Round {
  const shown = round.current ? [...round.shown, { word: round.current, ok: false }] : round.shown;
  return { ...round, shown, current: null, phase: 'results', ended: reason, remainingMs: reason === 'time' ? 0 : round.remainingMs };
}

const keyOf = (w: string) => w.trim().toLowerCase();

/**
 * Deals from one or several decks. Each deck keeps its own no-repeat bag across rounds and
 * restarts; a word never comes up twice in one round, and the dealer runs dry (undefined)
 * once every word of the chosen decks has been shown this round.
 */
export function makeDealer(decks: readonly WordDeck[], alreadyShown: readonly string[] = [], rand: () => number = Math.random) {
  const pools = decks
    .filter((d) => d.words.length > 0)
    .map((d) => ({ size: d.words.length, bag: makeBag('forehead:' + d.id, d.words, keyOf) }));
  const all = new Set(decks.flatMap((d) => d.words.map(keyOf)));
  const shown = new Set(alreadyShown.map(keyOf));
  const total = pools.reduce((n, p) => n + p.size, 0);

  function pickPool() {
    let r = rand() * total;
    for (const p of pools) if ((r -= p.size) < 0) return p;
    return pools[pools.length - 1];
  }

  return {
    next(): string | undefined {
      if (pools.length === 0 || [...all].every((k) => shown.has(k))) return undefined;
      for (let tries = 0; tries < 500; tries++) {
        const w = pickPool().bag.next();
        if (w && !shown.has(keyOf(w))) {
          shown.add(keyOf(w));
          return w;
        }
      }
      const left = decks.flatMap((d) => d.words).find((w) => !shown.has(keyOf(w)));
      if (left) shown.add(keyOf(left));
      return left;
    },
  };
}
