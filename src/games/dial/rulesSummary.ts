/** The setup's Rules card line, in plain words. */
export const rulesSummary = (goal: number, steal: boolean): string =>
  `First to ${goal} points · ${steal ? 'steals on' : 'no steals'}`;
