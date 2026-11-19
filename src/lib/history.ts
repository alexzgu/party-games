// A log of finished rounds and games, newest first, kept on this phone for scorekeeping.
import type { GameId } from '../app.config';
import { load, save } from './storage';

export interface HistoryEntry {
  id: string;
  game: GameId;
  /** ms since epoch, when it finished */
  at: number;
  /** One line for the list, e.g. "Sam got 7 of 10" or "Early Birds beat Night Owls 10–6". */
  title: string;
  /** Final scores, best first. For a solo Heads Down. round: one row. */
  scores: { name: string; score: number }[];
  /** Packs or decks played. */
  packs: string[];
  /** Optional lines shown when the entry is opened (words got/passed, clues given...). */
  details?: string[];
}

const KEY = 'history';
const MAX = 500;

export function history(): HistoryEntry[] {
  return load<HistoryEntry[]>(KEY, []);
}

/** Adds an entry and returns its id. */
export function record(entry: Omit<HistoryEntry, 'id' | 'at'>): string {
  const full: HistoryEntry = { ...entry, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: Date.now() };
  save(KEY, [full, ...history()].slice(0, MAX));
  return full.id;
}

/** Rewrites fields of an entry in place (e.g. a score fixed after the round). */
export function updateEntry(id: string, patch: Partial<Omit<HistoryEntry, 'id' | 'game'>>): void {
  save(KEY, history().map((e) => (e.id === id ? { ...e, ...patch } : e)));
}

export function removeEntry(id: string): void {
  save(KEY, history().filter((e) => e.id !== id));
}

export function clearHistory(): void {
  save(KEY, []);
}
