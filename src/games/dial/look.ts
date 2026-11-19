// Colours that identify each team on every screen (always paired with the team's name).
import type { TeamIndex } from './state';

export const TEAM_COLORS = ['var(--c-forehead)', 'var(--c-gibberish)'] as const;
export const teamColor = (t: TeamIndex): string => TEAM_COLORS[t];

export const DEFAULT_NAMES: [string, string] = ['Early Birds', 'Night Owls'];
