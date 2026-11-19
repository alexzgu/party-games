// Small presentation helpers shared by the Brain Freeze screens.
const PALETTE = ['var(--c-quick)', 'var(--c-dial)', 'var(--c-forehead)', 'var(--c-gold)', 'var(--c-gibberish)', 'var(--c-snark)', 'var(--c-taboo)', 'var(--c-pass)'];

/** A player's colour, by seat. Names are always shown too, so colour is never the only cue. */
export const playerColor = (i: number) => PALETTE[i % PALETTE.length];

export const initial = (name: string) => [...name.trim()][0]?.toUpperCase() ?? '?';

/** The prompt as players see it: "Name 3 things you'd find in a fridge". */
export const said = (prompt: string) => `Name 3 ${prompt}`;
