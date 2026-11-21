// Team names on Big Board's setup: the name a new team gets, the check a rename goes through, and
// tidying a list saved before names were checked (blank or repeated names).
import { DEFAULT_TEAMS } from './look';

const MAX_NAME = 18;
const tidy = (raw: string) => raw.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME);

/** The first of the default names nobody has, else "Team N" (N one past the list length, or the next free N). */
export function nextTeamName(names: readonly string[]): string {
  const taken = new Set(names.map((n) => n.toLowerCase()));
  const free = DEFAULT_TEAMS.find((d) => !taken.has(d.toLowerCase()));
  if (free) return free;
  let n = names.length + 1;
  while (taken.has(`team ${n}`)) n++;
  return `Team ${n}`;
}

/** A typed team name, tidied, and why it cannot be used ('' when it can). */
export function checkTeamName(raw: string, existing: readonly string[]): { name: string; error: string } {
  const name = tidy(raw);
  if (!name) return { name, error: 'Type a name first.' };
  if (existing.some((n) => n.toLowerCase() === name.toLowerCase())) return { name, error: `${name} is already a team.` };
  return { name, error: '' };
}

/**
 * Every name tidied and different: a blank one takes its seat's default name, and one already
 * used (or a blank whose default is) takes the next free name.
 */
export function tidyTeams(raw: readonly string[]): string[] {
  const out: string[] = [];
  raw.forEach((r, i) => {
    const name = tidy(r) || DEFAULT_TEAMS[i] || `Team ${i + 1}`;
    out.push(out.some((n) => n.toLowerCase() === name.toLowerCase()) ? nextTeamName(out) : name);
  });
  return out;
}
