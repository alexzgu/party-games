import { shuffle } from '../../lib/random';

/**
 * Who works on which Telephone chain: `square[step][player]` is a chain. Every row (step) and
 * column (player) holds each chain once, so each step everyone has a different chain and nobody
 * gets a chain twice. A cyclic square with its rows and columns shuffled, so who hands to whom
 * changes from step to step; then relabelled so step 0 has each player on their own chain.
 */
export function latinSquare(n: number, rand: () => number = Math.random): number[][] {
  const seq = Array.from({ length: n }, (_, i) => i);
  const rows = shuffle(seq, rand);
  const cols = shuffle(seq, rand);
  const raw = rows.map((r) => cols.map((c) => (r + c) % n));
  const label: number[] = [];
  raw[0]?.forEach((chain, player) => { label[chain] = player; });
  return raw.map((row) => row.map((chain) => label[chain]));
}
