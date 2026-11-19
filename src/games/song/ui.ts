// Small presentation helpers shared by the Earworm screens.
const PALETTE = ['var(--c-song)', 'var(--c-dial)', 'var(--c-forehead)', 'var(--c-gold)', 'var(--c-good)', 'var(--c-pass)'];

/** A player's colour, by seat. Names are always shown too, so colour is never the only cue. */
export const playerColor = (i: number) => PALETTE[i % PALETTE.length];

export const initial = (name: string) => [...name.trim()][0]?.toUpperCase() ?? '?';

/**
 * Where the current clip is: its preview is loading, ready to play, playing, played out, waiting
 * for a tap before the browser allows sound, or would not load.
 */
export type ClipStatus = 'loading' | 'ready' | 'playing' | 'done' | 'blocked' | 'error';
