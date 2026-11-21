// The pinned top of a pack page (components/PackList.svelte) and the parts that scroll on their
// own inside it (components/ScrollWindow.svelte): whether the players or teams start shown, and
// which edges of a scrolling part have more behind them (for its fades and hairlines).
import { load, save } from './storage';

/** Under this height (a small phone, any phone on its side) the players and teams start hidden. */
export const SHORT_SCREEN_PX = 700;
const KEY = 'setup:panel';

/**
 * Shown when the game needs changes there to start (too few players), else the phone's own choice
 * when it made one, else shown on a tall screen and hidden on a short one.
 */
export function openAtStart(saved: unknown, screenHeight: number, needed = false): boolean {
  if (needed) return true;
  return typeof saved === 'boolean' ? saved : screenHeight >= SHORT_SCREEN_PX;
}

/** Read once when a pack page opens, so the keyboard shrinking the screen never folds it. */
export const panelOpen = (needed: boolean): boolean => openAtStart(load<unknown>(KEY, null), innerHeight, needed);
/** One choice for every game, kept on the phone. */
export const savePanelOpen = (open: boolean): void => save(KEY, open);

export interface Edges {
  /** Something is scrolled away above. */
  above: boolean;
  /** Something is left to scroll to below. */
  below: boolean;
}

/** From a scroller's scrollTop, scrollHeight and clientHeight; a pixel of rounding is ignored. */
export function edges(top: number, height: number, view: number): Edges {
  return { above: top > 1, below: top + view < height - 1 };
}

/**
 * Calls `on` with `el`'s edges now, after it scrolls and whenever it or what is in it changes size
 * (a search, the tiles/list switch, an import, a new row), at most once a frame. Returns the undo.
 */
export function watchEdges(el: HTMLElement, on: (e: Edges) => void): () => void {
  let frame = 0;
  const check = () => { frame = 0; on(edges(el.scrollTop, el.scrollHeight, el.clientHeight)); };
  const soon = () => { frame ||= requestAnimationFrame(check); };
  const sizes = new ResizeObserver(soon);
  const watchKids = () => {
    sizes.disconnect();
    sizes.observe(el);
    for (const kid of el.children) sizes.observe(kid);
    soon();
  };
  const kids = new MutationObserver(watchKids);
  kids.observe(el, { childList: true });
  watchKids();
  check();
  el.addEventListener('scroll', soon, { passive: true });
  return () => {
    cancelAnimationFrame(frame);
    sizes.disconnect();
    kids.disconnect();
    el.removeEventListener('scroll', soon);
  };
}
