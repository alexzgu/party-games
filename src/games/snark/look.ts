// Player colours and small formatting helpers for Snark Tank's screens.
const PALETTE = ['var(--c-snark)', 'var(--c-forehead)', 'var(--c-gibberish)', 'var(--c-quiz)', 'var(--c-good)', 'var(--c-taboo)', 'var(--c-dial)', 'var(--c-pass)'];

/** A player's colour by seat. Names are always shown too, so colour is never the only cue. */
export const playerColor = (i: number) => PALETTE[i % PALETTE.length];

export const initial = (name: string) => [...name.trim()][0]?.toUpperCase() ?? '?';

/** 1st, 2nd, 3rd, 4th … */
export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th';
  return `${n}${s}`;
}

/** Whole seconds left, rounded up, for countdowns. */
export const secs = (ms: number | null) => (ms === null ? null : Math.ceil(ms / 1000));

export const roundName = (round: number, rounds: number) => (round >= rounds ? 'Final round' : `Round ${round}`);

/** The address phones open to join this room, carrying a non-default broker with it. */
export function joinLink(code: string, broker: string): string {
  const base = location.origin + location.pathname;
  return `${base}#/snark/join?code=${code}${broker ? `&peer=${encodeURIComponent(broker)}` : ''}`;
}
