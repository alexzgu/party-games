// Points. Head-to-head: each answer earns its share of the votes × 1000, times the round's
// multiplier, plus a bonus for taking every vote (2 or more). Final round: every vote is worth
// a fixed amount, so a crowd favourite can still swing the game.
export const DUEL_POT = 1000;
export const SWEEP_BONUS = 250;
export const SWEEP_MIN_VOTES = 2;
export const FINAL_VOTE_POINTS = 400;
export const FINAL_VOTES_EACH = 3;

export interface Result {
  /** Votes each author received. */
  votes: Record<string, number>;
  /** Points each author earned on this prompt (bonus included). */
  points: Record<string, number>;
  /** The author who took every vote, when that earned the bonus. */
  sweep?: string;
}

/** A head-to-head prompt. `ballots` maps each voter to the author they picked. */
export function scoreDuel(a: string, b: string, ballots: Record<string, string>, multiplier: number): Result {
  const votes: Record<string, number> = { [a]: 0, [b]: 0 };
  for (const pick of Object.values(ballots)) if (pick === a || pick === b) votes[pick]++;
  const total = votes[a] + votes[b];
  const points: Record<string, number> = { [a]: 0, [b]: 0 };
  if (total === 0) return { votes, points };
  for (const pid of [a, b]) points[pid] = Math.round((DUEL_POT * multiplier * votes[pid]) / total);
  const sweep = total >= SWEEP_MIN_VOTES ? [a, b].find((pid) => votes[pid] === total) : undefined;
  if (sweep) points[sweep] += SWEEP_BONUS * multiplier;
  return sweep ? { votes, points, sweep } : { votes, points };
}

/** The final round. `ballots` maps each voter to how many of their votes went to each author. */
export function scoreFinal(authors: readonly string[], ballots: Record<string, Record<string, number>>): Result {
  const votes: Record<string, number> = Object.fromEntries(authors.map((pid) => [pid, 0]));
  for (const ballot of Object.values(ballots)) {
    for (const [pid, n] of Object.entries(ballot)) if (pid in votes) votes[pid] += n;
  }
  const points = Object.fromEntries(authors.map((pid) => [pid, votes[pid] * FINAL_VOTE_POINTS]));
  return { votes, points };
}

/** A final-round ballot is valid when it gives 1–3 whole votes, only to answers other than the voter's own. */
export function validFinalBallot(voter: string, ballot: Record<string, number>, votable: ReadonlySet<string>): boolean {
  let sum = 0;
  for (const [pid, n] of Object.entries(ballot)) {
    if (pid === voter || !votable.has(pid) || !Number.isInteger(n) || n < 0) return false;
    sum += n;
  }
  return sum >= 1 && sum <= FINAL_VOTES_EACH;
}
