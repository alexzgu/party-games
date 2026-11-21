/** The setup's Rules card line, in plain words. */
export function rulesSummary(seconds: number, target: number, steal: boolean, stealUsesTurn: boolean): string {
  const steals = !steal ? 'no steals' : stealUsesTurn ? 'a steal uses your turn' : 'steals on';
  return `${seconds} s on the clock · ${target} points wins · ${steals}`;
}
