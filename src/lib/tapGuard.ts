// Taps on a control in the first moments after it appears are the tail of a double tap on the
// screen before (the next screen's control often sits where the last one was), so they are ignored.

export const TAP_GUARD_MS = 400;

/** Call when the control appears; the returned check is true once taps on it count. */
export function tapGuard(ms = TAP_GUARD_MS, now: () => number = () => performance.now()): () => boolean {
  const shownAt = now();
  return () => now() - shownAt >= ms;
}
