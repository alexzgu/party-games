// Hash routing: works from any host or subpath (GitHub Pages, a laptop, a file) with no server rules.
export type Route = { path: string; params: URLSearchParams };

function parse(): Route {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [path, query = ''] = hash.split('?');
  return { path: path || '/', params: new URLSearchParams(query) };
}

export const route = $state<Route>(parse());

// Counts in-app steps so Back never leaves the app when a page was opened directly.
let depth = 0;

addEventListener('hashchange', () => {
  const next = parse();
  route.path = next.path;
  route.params = next.params;
});

export function go(path: string, replace = false): void {
  const url = '#' + path;
  if (replace) {
    history.replaceState(null, '', url);
    const next = parse();
    route.path = next.path;
    route.params = next.params;
  } else {
    depth++;
    location.hash = path;
  }
}

export function back(fallback = '/'): void {
  if (depth > 0) {
    depth--;
    history.back();
  } else go(fallback, true);
}
