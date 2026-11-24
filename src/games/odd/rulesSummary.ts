/** The setup's Rules card line, in plain words. */
export function rulesSummary(rounds: number, hint: boolean, oddNeverStarts: boolean): string {
  return [`${rounds} rounds`, hint ? 'hint on' : 'no hint', oddNeverStarts ? 'odd one never starts' : 'anyone starts'].join(' · ');
}
