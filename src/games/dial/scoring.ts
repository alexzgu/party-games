// Scoring for Spectrum: the dial runs 0–100, the target centre sits in [4, 96], and points
// depend on how far the locked needle is from that centre.

export type Side = 'left' | 'right';

/** Half-widths of the scoring bands around the target centre, best first. */
export const BANDS = [
  { half: 2.5, points: 4 },
  { half: 7.5, points: 3 },
  { half: 12.5, points: 2 },
] as const;

export const TARGET_MIN = 4;
export const TARGET_MAX = 96;

const EPS = 1e-9;

export function pointsFor(target: number, guess: number): number {
  const d = Math.abs(target - guess);
  for (const b of BANDS) if (d <= b.half + EPS) return b.points;
  return 0;
}

export function randomTarget(rand: () => number = Math.random): number {
  return Math.round((TARGET_MIN + rand() * (TARGET_MAX - TARGET_MIN)) * 10) / 10;
}

/** Which side of the needle the target is on; null when the needle sits exactly on it. */
export function sideOf(target: number, guess: number): Side | null {
  if (Math.abs(target - guess) < EPS) return null;
  return target < guess ? 'left' : 'right';
}

/** The other team's left/right call: 1 point when the target is on the side they named. */
export function stealPoints(target: number, guess: number, call: Side | null): number {
  return call !== null && sideOf(target, guess) === call ? 1 : 0;
}

export interface Segment { from: number; to: number; points: number }

/** The five coloured wedges around a target, clipped to the dial. */
export function bandSegments(target: number): Segment[] {
  const [b4, b3, b2] = BANDS;
  const edges: Segment[] = [
    { from: target - b2.half, to: target - b3.half, points: b2.points },
    { from: target - b3.half, to: target - b4.half, points: b3.points },
    { from: target - b4.half, to: target + b4.half, points: b4.points },
    { from: target + b4.half, to: target + b3.half, points: b3.points },
    { from: target + b3.half, to: target + b2.half, points: b2.points },
  ];
  return edges
    .map((s) => ({ ...s, from: Math.max(0, s.from), to: Math.min(100, s.to) }))
    .filter((s) => s.to - s.from > EPS);
}
