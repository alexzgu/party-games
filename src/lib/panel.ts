// The pinned top of a pack page, a pack editor or a Community list (components/PinnedPanel.svelte) and the parts
// that scroll on their own (its scroller, components/ScrollWindow.svelte): whether the part that
// folds starts shown, which edges of a scrolling part have more behind them (for its fades and
// hairlines), and bringing an item into view in its scroller.
import { load, save } from './storage';

/** Under this height (a small phone, any phone on its side) the part that folds starts hidden. */
export const SHORT_SCREEN_PX = 700;

/**
 * Pages sharing one fold choice: the setups (players, teams), the pack editors (pack details) and
 * the Community lists (search and filters).
 */
export type PanelKind = 'setup' | 'editor' | 'community';
const KEYS: Record<PanelKind, string> = { setup: 'setup:panel', editor: 'editor:panel', community: 'community:panel' };

/**
 * Shown when the game needs changes there to start (too few players), else the phone's own choice
 * when it made one, else shown on a tall screen and hidden on a short one.
 */
export function openAtStart(saved: unknown, screenHeight: number, needed = false): boolean {
  if (needed) return true;
  return typeof saved === 'boolean' ? saved : screenHeight >= SHORT_SCREEN_PX;
}

/** Read once when the page opens, so the keyboard shrinking the screen never folds it. */
export const panelOpen = (needed: boolean, kind: PanelKind = 'setup'): boolean =>
  openAtStart(load<unknown>(KEYS[kind], null), innerHeight, needed);
/** One choice for every game's pages of that kind, kept on the phone. */
export const savePanelOpen = (open: boolean, kind: PanelKind = 'setup'): void => save(KEYS[kind], open);

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

/**
 * Svelte action: scrolls `node` into view in its scroller (as little as needed) when it appears
 * with `on` true and whenever `on` turns true: an item opened for editing, one just added.
 */
export function reveal(node: HTMLElement, on = true) {
  const show = (now: boolean) => { if (now) requestAnimationFrame(() => nearest(node)); };
  show(on);
  return { update: show };
}

/** Scrolls only `node`'s own scroller (never the page) as little as needed to show it. */
function nearest(node: HTMLElement) {
  let box = node.parentElement;
  while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
  if (!box) return;
  const a = node.getBoundingClientRect();
  const b = box.getBoundingClientRect();
  if (a.top < b.top) box.scrollTop -= b.top - a.top;
  else if (a.bottom > b.bottom) box.scrollTop += Math.min(a.bottom - b.bottom, a.top - b.top);
}
