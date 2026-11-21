// A pausable countdown as plain data: `left` is what remained when it last stopped, `since`
// when it last started (null while paused). Times in milliseconds.

export interface Countdown { length: number; left: number; since: number | null }

export const countdown = (length: number): Countdown => ({ length, left: length, since: null });

/** Time left at `now`, never below 0. */
export const timeLeft = (c: Countdown, now: number): number => Math.max(0, c.since === null ? c.left : c.left - (now - c.since));

export const running = (c: Countdown, now: number): boolean => c.since !== null && timeLeft(c, now) > 0;

/** Starts or resumes; a finished countdown starts again from its full length. */
export function start(c: Countdown, now: number): Countdown {
  const left = timeLeft(c, now);
  return { ...c, left: left > 0 ? left : c.length, since: now };
}

export const pause = (c: Countdown, now: number): Countdown => ({ ...c, left: timeLeft(c, now), since: null });

/** Tap: start when stopped, pause when running. */
export const toggle = (c: Countdown, now: number): Countdown => (running(c, now) ? pause(c, now) : start(c, now));

/** Back to full (or a new) length, stopped. */
export const reset = (c: Countdown, length = c.length): Countdown => countdown(length);
