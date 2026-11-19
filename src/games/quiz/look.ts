// How teams look on every screen. A team's name is always shown with its colour, never colour alone.
// The 20 colours live in tokens.css (--team-1 … --team-20), one set per colour scheme.
export const teamColor = (i: number): string => `var(--team-${(i % 20) + 1})`;

export const DEFAULT_TEAMS = [
  'Smarty Pants', 'Know-It-Alls', 'Lucky Guesses', 'Wild Cards', 'Quizzly Bears',
  'Big Brains', 'Night Owls', 'Hot Takes', 'Fun Facts', 'Dark Horses',
  'Long Shots', 'Couch Experts', 'Total Nerds', 'Fast Fingers', 'Wise Guys',
  'Plot Twists', 'Late Bloomers', 'Usual Suspects', 'Underdogs', 'Free Thinkers',
];

/** A typed team name, tidied, or the default for that seat when left blank. */
export const teamName = (raw: string, i: number): string => raw.trim().replace(/\s+/g, ' ').slice(0, 18) || DEFAULT_TEAMS[i] || `Team ${i + 1}`;
