// Hash routing: works from any host or subpath (GitHub Pages, a laptop, a file) with no server rules.
export type Route = { path: string; params: URLSearchParams };

function parse(): Route {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = hash.split('?');
  return { path: path || '/', params: new URLSearchParams(query) };
}

export const route = $state<Route>(parse());

/**
 * In-app steps behind the current page. Each history entry carries its own count, so it stays
 * right after the browser's or Android's back gesture and after a reload; Back never leaves the
 * app when a page was opened directly.
 */
const stepsHere = (): number => {
  const d = (history.state as { depth?: unknown } | null)?.depth;
  return typeof d === 'number' && d >= 0 ? d : 0;
};
let depth = stepsHere();

function sync(): void {
  const next = parse();
  route.path = next.path;
  route.params = next.params;
}

addEventListener('hashchange', () => {
  sync();
  depth = stepsHere();
});

export function go(path: string, replace = false): void {
  const url = '#' + path;
  if (replace) {
    history.replaceState({ depth }, '', url);
    sync();
  } else if (location.hash !== url) {
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
