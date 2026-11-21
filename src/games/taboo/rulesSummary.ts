import type { Config } from './state';

/** The setup's Rules card line, in plain words. */
export function rulesSummary(c: Pick<Config, 'seconds' | 'mode' | 'goal' | 'rounds' | 'skipCost'>): string {
  const until = c.mode === 'score' ? `first to ${c.goal} points` : `${c.rounds} ${c.rounds === 1 ? 'round' : 'rounds'}`;
  return `${c.seconds} s turns · ${until} · ${c.skipCost ? 'skips cost a point' : 'skips are free'}`;
}
