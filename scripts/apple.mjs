// Apple Music (iTunes Search API) and YouTube oEmbed calls for the laptop scripts
// (match-songs.mjs, clip-songs.mjs), kept under Apple's limit of about 20 calls a minute.
import { toTrack } from '../src/games/song/match.ts';
import { makeLimiter, batches } from '../src/games/song/limit.ts';

const API = 'https://itunes.apple.com';
const apple = makeLimiter(18, 60_000);
export const log = (...a) => console.error(...a);

async function getJson(url) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url).catch((e) => ({ ok: false, status: 0, why: e.cause?.code ?? e.message }));
    if (res.ok) return res.json();
    if (attempt < 2 && (res.status === 0 || res.status === 403 || res.status === 429 || res.status >= 500)) {
      log(`  (${res.status || res.why}; waiting 30 s)`);
      await new Promise((r) => setTimeout(r, 30_000));
      continue;
    }
    throw new Error(`${url}: HTTP ${res.status || res.why}`);
  }
}
const appleJson = (url) => apple.run(() => getJson(url));
const tracksOf = (j) => (j.results ?? []).map(toTrack).filter(Boolean);

/** Apple track id → its Track (null when Apple has none), for every id looked up so far. */
export const known = new Map();
/** Apple track id → the song's full length in seconds, when Apple says. */
export const lengths = new Map();

export async function lookupMany(ids) {
  const missing = [...new Set(ids)].filter((id) => !known.has(id));
  for (const group of batches(missing, 50)) {
    const j = await appleJson(`${API}/lookup?id=${group.join(',')}&country=US`);
    const found = tracksOf(j);
    for (const r of j.results ?? []) if (r.trackId && r.trackTimeMillis) lengths.set(r.trackId, r.trackTimeMillis / 1000);
    for (const id of group) known.set(id, found.find((t) => t.id === id) ?? null);
  }
  return ids.map((id) => known.get(id));
}

/** What the matcher (src/games/song/match.ts) needs, from the laptop. */
export const deps = {
  search: async (term) => tracksOf(await appleJson(`${API}/search?term=${encodeURIComponent(term.toLowerCase())}&entity=song&limit=25&country=US`)),
  artistSongs: async (artist) => {
    const found = await appleJson(`${API}/search?term=${encodeURIComponent(artist.toLowerCase())}&entity=musicArtist&limit=1&country=US`);
    const id = found.results?.[0]?.artistId;
    return id ? tracksOf(await appleJson(`${API}/lookup?id=${id}&entity=song&limit=200&country=US`)) : [];
  },
  lookup: async (id) => (await lookupMany([id]))[0],
  oembed: async (id) => {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`);
    if (!res.ok) return null;
    const j = await res.json();
    return { title: j.title, author: j.author_name ?? '' };
  },
};
