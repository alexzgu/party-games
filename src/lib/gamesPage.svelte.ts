// The Games page's choices on this phone, as Svelte state, saved on every change (gamesView.ts
// holds the rules).
import type { GameId } from '../app.config';
import { markOpened, readState, type GamesState } from './gamesView';
import { load, save } from './storage';

const KEY = 'games:view';

export const gamesPage = $state<GamesState>(readState(load<unknown>(KEY, null)));

/** Replaces the choices with `next` and keeps them. */
export function setGamesPage(next: GamesState): void {
  Object.assign(gamesPage, next);
  save(KEY, $state.snapshot(gamesPage));
}

/** A game opened from the Games page counts for the Recent order. */
export const noteOpened = (id: GameId): void => setGamesPage(markOpened($state.snapshot(gamesPage), id, Date.now()));
