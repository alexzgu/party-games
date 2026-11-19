// Names shown to players live here only, so renaming is a one-line change.
export const APP = {
  name: 'Jerk Box',
  shortName: 'Jerk Box',
} as const;

export type GameId = 'forehead' | 'dial' | 'gibberish' | 'quiz';

export interface GameInfo {
  id: GameId;
  name: string;
  players: string;
  /** CSS colour token name for the game's accent, see tokens.css */
  accent: string;
  emoji: string;
}

export const GAMES: GameInfo[] = [
  { id: 'forehead', name: 'Heads Down.', players: '2+ players', accent: 'var(--c-forehead)', emoji: '🤯' },
  { id: 'dial', name: 'Spectrum', players: '4+ players · 2 teams', accent: 'var(--c-dial)', emoji: '📡' },
  { id: 'gibberish', name: 'Inn Co Hear Ant', players: '3+ players', accent: 'var(--c-gibberish)', emoji: '🗣️' },
  { id: 'quiz', name: 'Big Board', players: '2–4 teams', accent: 'var(--c-quiz)', emoji: '🧠' },
];

/** The name players see for a game; screens read it from here, never hard-code it. */
export const gameName = (id: GameId): string => GAMES.find((g) => g.id === id)!.name;
