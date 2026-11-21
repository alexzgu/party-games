import { describe, expect, it } from 'vitest';
import { checkTeamName, nextTeamName, tidyTeams } from './teams';
import { DEFAULT_TEAMS } from './look';

describe('Big Board team names', () => {
  it('gives a new team the first default name not in use, then "Team N"', () => {
    expect(nextTeamName([])).toBe(DEFAULT_TEAMS[0]);
    expect(nextTeamName([DEFAULT_TEAMS[0], 'Reds', DEFAULT_TEAMS[2].toUpperCase()])).toBe(DEFAULT_TEAMS[1]);
    expect(nextTeamName(DEFAULT_TEAMS)).toBe('Team 11');
    expect(nextTeamName([...DEFAULT_TEAMS.slice(1), 'Team 11', DEFAULT_TEAMS[0]])).toBe('Team 12');
  });

  it('keeps a tidy new name and turns down a blank or repeated one', () => {
    expect(checkTeamName('  Big   Reds ', ['Blues'])).toEqual({ name: 'Big Reds', error: '' });
    expect(checkTeamName('A very long team name indeed', []).name).toBe('A very long team n');
    expect(checkTeamName('   ', ['Blues']).error).toBe('Type a name first.');
    expect(checkTeamName('blues', ['Blues']).error).toBe('blues is already a team.');
  });

  it('tidies a saved list: blanks take their seat default, repeats the next free name', () => {
    expect(tidyTeams(['Reds', '', ' reds '])).toEqual(['Reds', DEFAULT_TEAMS[1], DEFAULT_TEAMS[0]]);
    expect(tidyTeams(['', DEFAULT_TEAMS[0]])).toEqual([DEFAULT_TEAMS[0], DEFAULT_TEAMS[1]]);
    expect(tidyTeams(['Reds', 'Blues'])).toEqual(['Reds', 'Blues']);
  });
});
