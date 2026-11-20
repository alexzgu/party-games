// Who answers which prompt in a head-to-head round: one prompt per player, each prompt to two
// different players, so every player gets exactly two prompts and faces two different rivals.
import { shuffle } from '../../lib/random';

export interface Pairing { prompt: string; a: string; b: string }

/**
 * Seats the players in a random ring; prompt i goes to seat i and seat i+1. With 3+ players
 * the two authors always differ and every player is in exactly two pairings.
 */
export function assignPrompts(pids: readonly string[], prompts: readonly string[], rand: () => number = Math.random): Pairing[] {
  const n = pids.length;
  if (n < 3) throw new Error('need 3+ players');
  if (prompts.length < n) throw new Error('need one prompt per player');
  const ring = shuffle(pids, rand);
  const pairings = ring.map((pid, i) => ({ prompt: prompts[i], a: pid, b: ring[(i + 1) % n] }));
  // Vote order: shuffled, so nobody can work out the ring from the order on screen.
  return shuffle(pairings, rand);
}

export interface Pairs { pairs: [string, string][]; /** The odd one out, who faces the house. */ alone?: string }

/**
 * Pairs for the three-line duels: random pairs; with an odd count the player in last place
 * (ties broken at random, by the shuffle) sits out the pairing and faces the house instead.
 */
export function pairDuels(pids: readonly string[], score: (pid: string) => number, rand: () => number = Math.random): Pairs {
  let order = shuffle(pids, rand);
  let alone: string | undefined;
  if (order.length % 2) {
    const low = Math.min(...order.map(score));
    alone = order.find((pid) => score(pid) === low)!;
    order = order.filter((pid) => pid !== alone);
  }
  const pairs: [string, string][] = [];
  for (let i = 0; i + 1 < order.length; i += 2) pairs.push([order[i], order[i + 1]]);
  return alone === undefined ? { pairs } : { pairs, alone };
}
