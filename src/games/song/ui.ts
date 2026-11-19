// Small presentation helpers shared by the Earworm screens.
const PALETTE = ['var(--c-song)', 'var(--c-dial)', 'var(--c-forehead)', 'var(--c-gold)', 'var(--c-good)', 'var(--c-pass)'];

/** A player's colour, by seat. Names are always shown too, so colour is never the only cue. */
export const playerColor = (i: number) => PALETTE[i % PALETTE.length];

export const initial = (name: string) => [...name.trim()][0]?.toUpperCase() ?? '?';

export type StageMode = 'hidden' | 'covered' | 'shown' | 'over';

/**
 * How the YouTube player's box looks. The reveal shows the video only while the player holds
 * this round's song: once the next song is cued there (at the end of the reveal, so it is ready
 * when Scores is tapped), the box is covered, so its thumbnail and title never show early.
 */
export function stageMode(phase: string, song: string | undefined, loaded: string, demo = false): StageMode {
  if (phase === 'listen') return 'covered';
  if (phase !== 'reveal') return 'hidden';
  return demo || (!!song && loaded === song) ? 'shown' : 'over';
}
