// A Spotify song link's title, from Spotify's public oEmbed endpoint (no key, no login, CORS
// open). It gives the title only, never the artist. Not the Spotify Web API or SDK: their terms
// rule out games. Polite: a few calls at a time, each given up after a few seconds, and every
// answer remembered for the session.
import { NetError } from './itunes';

const OEMBED = 'https://open.spotify.com/oembed?url=';
/** Calls in flight at once. */
export const AT_ONCE = 3;
/** A call that takes longer is given up. */
export const TIMEOUT_MS = 8000;

let active = 0;
const queue: (() => void)[] = [];

async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= AT_ONCE) await new Promise<void>((go) => queue.push(go));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    queue.shift()?.();
  }
}

async function ask(id: string): Promise<string | null> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), TIMEOUT_MS);
  try {
    let res: Response;
    try {
      res = await fetch(OEMBED + encodeURIComponent(`https://open.spotify.com/track/${id}`), { signal: stop.signal });
    } catch {
      throw new NetError(stop.signal.aborted ? 'Spotify took too long' : 'no answer from Spotify');
    }
    if (res.status === 400 || res.status === 404) return null;
    if (!res.ok) throw new NetError(`Spotify HTTP ${res.status}`);
    let j: { title?: unknown };
    try { j = await res.json(); } catch { throw new NetError('bad answer from Spotify'); }
    return typeof j?.title === 'string' && j.title.trim() ? j.title.trim() : null;
  } finally {
    clearTimeout(timer);
  }
}

const titles = new Map<string, Promise<string | null>>();

/** A Spotify track's title, or null when Spotify has no such song. Throws NetError when Spotify does not answer. */
export function spotifyTitle(id: string): Promise<string | null> {
  const hit = titles.get(id);
  if (hit) return hit;
  const p = slot(() => ask(id));
  titles.set(id, p);
  p.catch(() => titles.delete(id));
  return p;
}
