import type { FinalStyle } from './logic';

/** The settings page's Rules row, in plain words. */
export const settingsSummary = (rounds: 2 | 3, answerSecs: number, voteSecs: number, final: FinalStyle): string =>
  `${rounds} rounds · ${answerSecs} s to write · ${voteSecs} s to vote · ${final === 'duels' ? 'duel final' : '3-vote final'}`;
