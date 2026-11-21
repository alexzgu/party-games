// Hash routing: works from any host or subpath (GitHub Pages, a laptop, a file) with no server rules.
import { tick } from 'svelte';

export type Route = { path: string; params: URLSearchParams };

function parse(): Route {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = hash.split('?');
  return { path: path || '/', params: new URLSearchParams(query) };
}

export const route = $state<Route>(parse());

/**
 * Each history entry carries its own state: `depth`, the in-app steps behind it, so it stays
 * right after the browser's or Android's back gesture and after a reload, and Back never leaves
 * the app when a page was opened directly; `y`, how far the page was scrolled when it was left.
 */
type EntryState = { depth?: unknown; y?: unknown };
const entry = (): EntryState => (history.state as EntryState | null) ?? {};
const stepsHere = (): number => {
  const d = entry().depth;
  return typeof d === 'number' && d >= 0 ? d : 0;
};
let depth = stepsHere();

// The app places the page itself: a new screen starts at the top, a return restores its scroll.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

function sync(): void {
  const next = parse();
  route.path = next.path;
  route.params = next.params;
  const y = entry().y;
  const to = typeof y === 'number' ? y : 0;
  void tick().then(() => {
    scrollTo(0, to);
    if (to > 0) requestAnimationFrame(() => scrollTo(0, to)); // a game page may render a moment later
  });
}

addEventListener('hashchange', () => {
  depth = stepsHere();
  sync();
});

/** Where `backHome` is walking to, settled when the walk lands. */
let homing = false;
addEventListener('popstate', () => {
  if (!homing) return;
  homing = false;
  depth = stepsHere();
  if (parse().path !== '/') go('/', true); // the app was opened on a game's own address
});

export function go(path: string, replace = false): void {
  const url = '#' + path;
  if (replace) {
    history.replaceState({ depth }, '', url);
    sync();
  } else if (location.hash !== url) {
    history.replaceState({ ...entry(), depth, y: scrollY }, ''); // remembered for Back
    location.hash = path; // a new entry; hashchange updates the route
    history.replaceState({ depth: ++depth }, '', url);
  }
}

/**
 * Returns to the page before this one, the way it was reached: a screen left with `go` instead
 * would sit on top of the one it came from, and Back there would return to it in a loop.
 */
export function back(fallback = '/'): void {
  if (depth > 0) {
    depth--;
    history.back();
  } else go(fallback, true);
}

/**
 * Leaves for the main menu by walking back through every in-app step, so the menu never sits on
 * top of a game (where Back would return into it) and Back from the menu leaves the app.
 */
export function backHome(): void {
  if (depth === 0) {
    go('/', true);
    return;
  }
  homing = true;
  const steps = depth;
  depth = 0;
  history.go(-steps);
}
