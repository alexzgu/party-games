// How teams look on every screen. A team's name is always shown with its colour, never colour alone.
// The 20 colours live in tokens.css (--team-1 … --team-20), one set per colour scheme; games saved
// when 20 teams were allowed still use them all.
export const teamColor = (i: number): string => `var(--team-${(i % 20) + 1})`;

export const DEFAULT_TEAMS = [
  'Smarty Pants', 'Know-It-Alls', 'Lucky Guesses', 'Wild Cards', 'Quizzly Bears',
  'Big Brains', 'Night Owls', 'Hot Takes', 'Fun Facts', 'Dark Horses',
];
