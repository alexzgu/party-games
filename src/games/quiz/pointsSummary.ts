import { points, rowValues } from './logic';

/** The setup's Points card line, in plain words: what the rows are worth and what a wrong answer costs. */
export function pointsSummary(rows: number, double: boolean, penalty: boolean): string {
  const v = rowValues(rows, double);
  return `Tiles ${points(v[0])}–${points(v[v.length - 1])} · ${penalty ? 'wrong answers lose points' : 'wrong answers cost nothing'}`;
}
