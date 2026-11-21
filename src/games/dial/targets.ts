// Where the next Spectrum target sits: a part of the dial from a shuffle bag kept across games,
// then a spot in it away from the last target (scoring.ts spreadTarget).
import { makeBag } from '../../lib/bag';
import { load, save } from '../../lib/storage';
import { spreadTarget, ZONES } from './scoring';

const LAST = 'dial:last-target';
const zones = makeBag('dial:zones', Array.from({ length: ZONES }, (_, i) => i), String);

export function nextTarget(): number {
  const previous = load<number | null>(LAST, null);
  const t = spreadTarget(zones.next() ?? 0, typeof previous === 'number' ? previous : null);
  save(LAST, t);
  return t;
}
