// The Games page's choices on this phone, as Svelte state, saved on every change (gamesView.ts
// holds the rules).
import type { GameId } from '../app.config';
import { markOpened, readState, type GamesState } from './gamesView';
import { load, save } from './storage';

const KEY = 'games:view';

export const gamesPage = $state<GamesState>(readState(load<unknown>(KEY, null)));

/**
 * The opening times the Recent order goes by on screen: taken when the page is opened from the
 * main menu (and when the app starts), so a game just opened never moves the list under the tap,
 * and Back from it finds the list as it was left.
 */
let shownOpened = $state.snapshot(gamesPage.opened);
export const openedForOrder = (): GamesState['opened'] => shownOpened;
/** The Games page opened anew: Recent takes in the games opened since. */
export function freshOrder(): void {
  shownOpened = $state.snapshot(gamesPage.opened);
}

/** Replaces the choices with `next` and keeps them. */
export function setGamesPage(next: GamesState): void {
  Object.assign(gamesPage, next);
  save(KEY, $state.snapshot(gamesPage));
}

/** A game opened from the Games page counts for the Recent order (from the next fresh one). */
export const noteOpened = (id: GameId): void => setGamesPage(markOpened($state.snapshot(gamesPage), id, Date.now()));
