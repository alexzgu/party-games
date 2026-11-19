// Talks to Apple's iTunes Search API (no key; CORS open) and YouTube's oEmbed endpoint (for a
// video's title). Every Apple call goes through one rate-limited queue; track lookups are
// batched and remembered on the phone for a week.
import { load, save } from '../../lib/storage';
import { toTrack, type MatchDeps, type Track } from './match';
import { batches, fresh, makeLimiter, remember, type Cached } from './limit';

const API = 'https://itunes.apple.com';
const COUNTRY = 'US';
/** Apple allows roughly 20 calls a minute; stay a little under. */
export const apple = makeLimiter(18, 60_000);
/** Ids per lookup call (Apple accepts many; this keeps URLs short). */
const LOOKUP_BATCH = 50;
const TRACKS = 'song:tracks';
const TRACK_MAX_AGE = 7 * 24 * 3600 * 1000;
const KEEP = 1500;

/** The network failed (offline, blocked, or Apple said no). */
export class NetError extends Error {
  constructor(message: string, readonly offline = typeof navigator !== 'undefined' && navigator.onLine === false) { super(message); }
}

async function getJson(url: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new NetError('no answer');
  }
  if (!res.ok) throw new NetError(`HTTP ${res.status}`);
  try { return await res.json(); } catch { throw new NetError('bad answer'); }
}

/** One Apple call through the queue; a "slow down" answer waits half a minute and tries once more. */
function appleJson(url: string): Promise<unknown> {
  return apple.run(async () => {
    try {
      return await getJson(url);
    } catch (e) {
      if (!(e instanceof NetError) || !/HTTP (403|429)/.test(e.message)) throw e;
      await new Promise((r) => setTimeout(r, 30_000));
      return getJson(url);
    }
  });
}

const results = (json: unknown) => (((json as { results?: unknown[] })?.results ?? []).map(toTrack).filter((t): t is Track => !!t));

const searches = new Map<string, Promise<Track[]>>();

/** Songs Apple finds for a search term, best first by Apple's own order. */
export function search(term: string): Promise<Track[]> {
  const key = term.trim().toLowerCase();
  const hit = searches.get(key);
  if (hit) return hit;
  const p = appleJson(`${API}/search?term=${encodeURIComponent(key)}&entity=song&limit=25&country=${COUNTRY}`).then(results);
  searches.set(key, p);
  p.catch(() => searches.delete(key));
  return p;
}

const catalogues = new Map<string, Promise<Track[]>>();

/** An artist's songs (up to 200): the artist is found by name, then their catalogue is listed. Two calls. */
export function artistSongs(artist: string): Promise<Track[]> {
  const key = artist.trim().toLowerCase();
  const hit = catalogues.get(key);
  if (hit) return hit;
  const p = (async () => {
    const found = (await appleJson(`${API}/search?term=${encodeURIComponent(key)}&entity=musicArtist&limit=1&country=${COUNTRY}`)) as { results?: { artistId?: number }[] };
    const id = found.results?.[0]?.artistId;
    return id ? results(await appleJson(`${API}/lookup?id=${id}&entity=song&limit=200&country=${COUNTRY}`)) : [];
  })();
  catalogues.set(key, p);
  p.catch(() => catalogues.delete(key));
  return p;
}

const loadCache = () => load<Record<string, Cached<Track>>>(TRACKS, {});

/** Tracks already known on this phone (fresh ones only), without asking Apple. */
export function cachedTracks(ids: number[]): Map<number, Track | null> {
  const cache = loadCache();
  const now = Date.now();
  const out = new Map<number, Track | null>();
  for (const id of ids) {
    const v = fresh(cache, String(id), now, TRACK_MAX_AGE);
    if (v !== undefined) out.set(id, v);
  }
  return out;
}

/**
 * Every id's track (null when Apple has no such song), from the phone's cache where fresh,
 * else in batched lookups. `force` asks Apple again (a preview link stopped working).
 * Throws NetError only when nothing could be fetched for ids that were not cached.
 */
export async function lookupMany(ids: number[], force = false, onBatch?: (done: number, total: number) => void): Promise<Map<number, Track | null>> {
  const unique = [...new Set(ids)];
  const out = force ? new Map<number, Track | null>() : cachedTracks(unique);
  const missing = unique.filter((id) => !out.has(id));
  const groups = batches(missing, LOOKUP_BATCH);
  let failure: unknown = null;
  for (const [i, group] of groups.entries()) {
    try {
      const found = results(await appleJson(`${API}/lookup?id=${group.join(',')}&country=${COUNTRY}`));
      const entries: [string, Track | null][] = group.map((id) => [String(id), found.find((t) => t.id === id) ?? null]);
      save(TRACKS, remember(loadCache(), entries, Date.now(), KEEP));
      for (const [k, v] of entries) out.set(Number(k), v);
    } catch (e) {
      failure = e;
    }
    onBatch?.(i + 1, groups.length);
  }
  if (failure && missing.every((id) => !out.has(id))) throw failure;
  return out;
}

export async function lookup(id: number): Promise<Track | null> {
  return (await lookupMany([id])).get(id) ?? null;
}

/** A YouTube video's title and channel, or null when YouTube will not say (removed, private or not embeddable). */
export async function oembed(videoId: string): Promise<{ title: string; author: string } | null> {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`;
  let res: Response;
  try { res = await fetch(url); } catch { throw new NetError('no answer from YouTube'); }
  if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) return null;
  if (!res.ok) throw new NetError(`YouTube HTTP ${res.status}`);
  const j = (await res.json()) as { title?: string; author_name?: string };
  return j.title ? { title: j.title, author: j.author_name ?? '' } : null;
}

export const deps: MatchDeps = { search, lookup, oembed, artistSongs };
