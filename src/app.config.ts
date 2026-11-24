// Names shown to players live here only, so renaming is a one-line change.
export const APP = {
  name: 'Jerk Box',
  shortName: 'Jerk Box',
} as const;

export type GameId = 'forehead' | 'dial' | 'gibberish' | 'quiz' | 'taboo' | 'quick' | 'snark' | 'salad' | 'brawl' | 'sketch' | 'hand';

/** Games whose packs players can make, import and export on a phone. */
export type PackGameId = Exclude<GameId, 'salad'>;

/** The default categories on the Games page, in the order their chips show. */
export const GAME_TAGS = ['One phone', 'Own phones', 'Teams', 'Words', 'Drawing', 'Trivia', 'Funny'] as const;
export type GameTag = (typeof GAME_TAGS)[number];

export interface GameInfo {
  id: GameId;
  name: string;
  players: string;
  /** The fewest players it needs and, when it has one, the most (the Games page's players filter). */
  minPlayers: number;
  maxPlayers?: number;
  /** The default categories it is in. */
  tags: GameTag[];
  /** CSS colour token name for the game's accent, see tokens.css */
  accent: string;
  emoji: string;
}

export const GAMES: GameInfo[] = [
  { id: 'forehead', name: 'Heads Down.', players: '2+ players', minPlayers: 2, tags: ['One phone', 'Words'], accent: 'var(--c-forehead)', emoji: '🤯' },
  { id: 'dial', name: 'Spectrum', players: '4+ players · 2 teams', minPlayers: 4, tags: ['One phone', 'Teams'], accent: 'var(--c-dial)', emoji: '📡' },
  { id: 'gibberish', name: 'Inn Co Hear Ant', players: '3+ players', minPlayers: 3, tags: ['One phone', 'Words'], accent: 'var(--c-gibberish)', emoji: '🗣️' },
  { id: 'quiz', name: 'Big Board', players: 'Solo or up to 10 teams', minPlayers: 1, tags: ['One phone', 'Teams', 'Trivia'], accent: 'var(--c-quiz)', emoji: '🧠' },
  { id: 'taboo', name: "Don't Say It", players: '4+ players · 2 teams', minPlayers: 4, tags: ['One phone', 'Teams', 'Words'], accent: 'var(--c-taboo)', emoji: '🤐' },
  { id: 'quick', name: 'Brain Freeze', players: '2+ players', minPlayers: 2, tags: ['One phone', 'Words'], accent: 'var(--c-quick)', emoji: '🥶' },
  { id: 'snark', name: 'Snark Tank', players: '3–8 players · own phones', minPlayers: 3, maxPlayers: 8, tags: ['Own phones', 'Funny'], accent: 'var(--c-snark)', emoji: '🦈' },
  { id: 'salad', name: 'Word Salad', players: '2–8 players · own phones', minPlayers: 2, maxPlayers: 8, tags: ['Own phones', 'Words'], accent: 'var(--c-salad)', emoji: '🥗' },
  { id: 'brawl', name: 'Doodle Brawl', players: '3–8 players · own phones', minPlayers: 3, maxPlayers: 8, tags: ['Own phones', 'Drawing', 'Funny'], accent: 'var(--c-brawl)', emoji: '🥊' },
  { id: 'sketch', name: 'Sketchy', players: '3–10 players · own phones', minPlayers: 3, maxPlayers: 10, tags: ['Own phones', 'Drawing'], accent: 'var(--c-sketch)', emoji: '✏️' },
  { id: 'hand', name: 'Bad Hand', players: '3–10 players · own phones', minPlayers: 3, maxPlayers: 10, tags: ['Own phones', 'Funny'], accent: 'var(--c-hand)', emoji: '🃏' },
];

/** Games taken out of the app, by id: an old pack file of one is turned away by name. */
export const RETIRED_GAMES: Readonly<Record<string, string>> = { song: 'Earworm' };

/** The name players see for a game; screens read it from here, never hard-code it. */
export const gameName = (id: GameId): string => GAMES.find((g) => g.id === id)!.name;
