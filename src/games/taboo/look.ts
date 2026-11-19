// Colours that identify each team on every screen (always paired with the team's name),
// shared with Spectrum's two-team tokens.
import type { TeamIndex } from './state';

export const TEAM_COLORS = ['var(--c-team-a)', 'var(--c-team-b)'] as const;
export const teamColor = (t: TeamIndex): string => TEAM_COLORS[t];

export const DEFAULT_NAMES: [string, string] = ['Loudmouths', 'Mimes'];
