// How teams look on every screen. A team's name is always shown with its colour, never colour alone.
const COLORS = ['var(--c-team-a)', 'var(--c-team-b)', 'var(--c-good)', 'var(--c-gibberish)'];

export const teamColor = (i: number): string => COLORS[i % COLORS.length];

export const DEFAULT_TEAMS = ['Smarty Pants', 'Know-It-Alls', 'Lucky Guesses', 'Wild Cards'];

/** A typed team name, tidied, or the default for that seat when left blank. */
export const teamName = (raw: string, i: number): string => raw.trim().replace(/\s+/g, ' ').slice(0, 18) || DEFAULT_TEAMS[i];
