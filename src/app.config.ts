// Names shown to players live here only, so renaming is a one-line change.
export const APP = {
  name: 'House Rules',
  shortName: 'House Rules',
  tagline: 'Party games for one phone and a loud room',
} as const;

export type GameId = 'forehead' | 'dial' | 'gibberish';

export interface GameInfo {
  id: GameId;
  name: string;
  tagline: string;
  players: string;
  /** CSS colour token name for the game's accent, see tokens.css */
  accent: string;
  emoji: string;
}

export const GAMES: GameInfo[] = [
  { id: 'forehead', name: 'Hot Head', tagline: 'Phone on your forehead. Friends shout clues. Tilt to score.', players: '2+ players', accent: 'var(--c-forehead)', emoji: '🤯' },
  { id: 'dial', name: 'Tuned In', tagline: 'One clue, one secret spot on a scale. Can your team read your mind?', players: '4+ players · 2 teams', accent: 'var(--c-dial)', emoji: '📡' },
  { id: 'gibberish', name: 'Say What?', tagline: 'Read the nonsense out loud. First to hear the real thing wins.', players: '3+ players', accent: 'var(--c-gibberish)', emoji: '🗣️' },
];
