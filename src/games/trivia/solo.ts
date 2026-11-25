// Solo: the room's questions and scoring on one phone with no room. Each question shows its
// category, then the question and four answers on a timer; the first tap is final; the reveal says
// right or wrong and the points, and Next moves on. Ten questions, then the score. Pure.
import { deal, points, toAsk } from './questions';
import { questionKey } from './rules';
import { CATEGORY_MS, type Asked, type Choice } from './state';

export const SOLO_COUNT = 10;

export type SoloPhase = 'category' | 'answer' | 'reveal' | 'over';
export type Solo = {
  questions: Asked[]; seconds: number;
  /** The question in play, from 1. */
  n: number; phase: SoloPhase; deadline: number | null;
  /** This question's tap (null: none yet, or time ran out) and the points it gained. */
  pick: Choice | null; gained: number;
  score: number; correct: number;
};

const enter = (s: Solo, phase: SoloPhase, now: number): Solo => ({
  ...s, phase, deadline: phase === 'category' ? now + CATEGORY_MS : phase === 'answer' ? now + s.seconds * 1000 : null,
});

/**
 * A new run from `pool` (the picked packs' lines, shuffled), avoiding the questions this phone
 * asked before (`asked`, keys) as a room does; null when the picks hold none. Returns the asked keys
 * still in the picks (none, after forgetting); each question joins them as it is shown (`shown`).
 */
export function soloStart(pool: readonly string[], asked: readonly string[], seconds: number, now: number, rand: () => number = Math.random): { solo: Solo; asked: string[] } | null {
  const dealt = deal(pool, asked, SOLO_COUNT);
  if (!dealt.questions.length) return null;
  const questions = dealt.questions.map((line) => toAsk(line, rand));
  const solo: Solo = { questions, seconds, n: 1, phase: 'category', deadline: null, pick: null, gained: 0, score: 0, correct: 0 };
  return { solo: enter(solo, 'category', now), asked: dealt.asked };
}

/** `asked` with the question now on screen, as a room remembers it: a run left early skips only what it showed. */
export const shown = (asked: readonly string[], s: Solo): string[] => {
  const key = questionKey(current(s).question);
  return asked.includes(key) ? [...asked] : [...asked, key];
};

/** The question in play. */
export const current = (s: Solo): Asked => s.questions[s.n - 1];

/** Time left on the timer, in ms (null: none). */
export const soloLeft = (s: Solo, now: number): number | null => s.deadline === null ? null : Math.max(0, s.deadline - now);

/** The first tap on an answer while time is left: final; scored as in a room. */
export function soloPick(s: Solo, choice: Choice, now: number): Solo {
  if (s.phase !== 'answer' || s.pick !== null || !soloLeft(s, now)) return s;
  const right = choice === current(s).right;
  const gained = points(right, soloLeft(s, now) ?? 0, s.seconds * 1000);
  return { ...enter(s, 'reveal', now), pick: choice, gained, score: s.score + gained, correct: s.correct + (right ? 1 : 0) };
}

/** The timer: from the category to the question; at the end of the question time, the reveal with no points. */
export function soloTick(s: Solo, now: number): Solo {
  if (s.deadline === null || s.deadline > now) return s;
  if (s.phase === 'category') return enter(s, 'answer', now);
  if (s.phase === 'answer') return { ...enter(s, 'reveal', now), pick: null, gained: 0 };
  return s;
}

/** Next: the category early, the next question after a reveal, or the end after the last. */
export function soloNext(s: Solo, now: number): Solo {
  if (s.phase === 'category') return enter(s, 'answer', now);
  if (s.phase !== 'reveal') return s;
  if (s.n >= s.questions.length) return enter(s, 'over', now);
  return enter({ ...s, n: s.n + 1, pick: null, gained: 0 }, 'category', now);
}
