// Small presentation helpers shared by the Odd One Out screens.
const PALETTE = ['var(--c-odd)', 'var(--c-dial)', 'var(--c-forehead)', 'var(--c-gold)', 'var(--c-gibberish)', 'var(--c-snark)', 'var(--c-taboo)', 'var(--c-pass)'];

/** A player's colour, by seat. Names are always shown too, so colour is never the only cue. */
export const playerColor = (i: number) => PALETTE[i % PALETTE.length];

export const initial = (name: string) => [...name.trim()][0]?.toUpperCase() ?? '?';
