/** The setup's Rules card line, in plain words; 0 seconds means no timer. */
export const rulesSummary = (seconds: number, target: number): string =>
  `${seconds ? `${seconds} s per card` : 'No timer'} · first to ${target} points`;
