// Matches songs to Apple Music tracks with the same matcher the app uses (src/games/song/match.ts).
//
//   node scripts/match-songs.mjs <lines.txt | ->      one song per line: YouTube or Apple Music
//                                                    links, or "Title - Artist"; prints the
//                                                    pack's "songs" JSON on stdout
//   node scripts/match-songs.mjs --pack <pack.json>   (re)matches every song in a pack file in
//                                                    place: keeps each YouTube id, drops songs
//                                                    with no match or no preview
//
// The report (✓ sure, ? check it, ✗ dropped, with the other candidates) goes to stderr.
// Apple allows about 20 calls a minute, so 40 songs take a few minutes. Needs internet.
import { readFileSync, writeFileSync } from 'node:fs';
import { matchWanted, parsePaste, tidy, toTrack } from '../src/games/song/match.ts';
import { makeLimiter, batches } from '../src/games/song/limit.ts';

const API = 'https://itunes.apple.com';
const apple = makeLimiter(18, 60_000);
const log = (...a) => console.error(...a);

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

const known = new Map();
async function lookupMany(ids) {
  const missing = ids.filter((id) => !known.has(id));
  for (const group of batches(missing, 50)) {
    const found = tracksOf(await appleJson(`${API}/lookup?id=${group.join(',')}&country=US`));
    for (const id of group) known.set(id, found.find((t) => t.id === id) ?? null);
  }
  return ids.map((id) => known.get(id));
}

const deps = {
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

const show = (t) => (t ? `${t.title} — ${t.artist} [${t.id}${t.preview ? '' : ', NO PREVIEW'}] (${t.album})` : '—');

function report(i, n, m) {
  const mark = !m.track || !m.track.preview ? '✗' : m.sure ? '✓' : '?';
  log(`${mark} ${String(i + 1).padStart(3)}/${n} ${m.line}\n        → ${m.track ? show(m.track) : m.why}`);
  if (mark !== '✓') for (const o of m.others.slice(0, 3)) log(`          or ${show(o)}`);
}

const songOf = (m, extra = {}) => {
  const { title, artist } = tidy(m.track);
  return { title, artist, apple: m.track.id, ...extra, ...(m.youtube ? { youtube: m.youtube } : {}) };
};

const args = process.argv.slice(2);
if (args[0] === '--pack') {
  const file = args[1];
  const pack = JSON.parse(readFileSync(file, 'utf8'));
  await lookupMany(pack.songs.filter((s) => s.apple).map((s) => s.apple));
  const kept = [];
  const dropped = [];
  for (const [i, s] of pack.songs.entries()) {
    const line = `${s.title} - ${s.artist}`;
    let m;
    if (s.apple) {
      const t = known.get(s.apple);
      m = { line, track: t, others: [], sure: !!t?.preview, why: t ? undefined : 'Apple has no such track' };
    } else {
      m = await matchWanted({ kind: 'text', query: `${s.title} ${s.artist}`, guesses: [{ title: s.title, artist: s.artist }], line }, deps);
    }
    report(i, pack.songs.length, m);
    if (!m.track?.preview) { dropped.push(`${line} (${m.why ?? 'no preview'})`); continue; }
    // Keep the pack's own title and artist (chosen for the room); Apple's id, preview and art.
    const song = { title: s.title, artist: s.artist, apple: m.track.id };
    if (s.apple && typeof s.start === 'number') song.start = s.start;
    if (s.youtube) song.youtube = s.youtube;
    kept.push(song);
  }
  writeFileSync(file, formatPack({ ...pack, songs: kept }));
  log(`\n${file}: ${kept.length} kept, ${dropped.length} dropped${dropped.length ? ':\n  ' + dropped.join('\n  ') : ''}`);
} else {
  const text = readFileSync(args[0] === '-' || !args[0] ? 0 : args[0], 'utf8');
  const wanted = parsePaste(text).filter((w) => w.kind !== 'playlist');
  const appleIds = wanted.filter((w) => w.kind === 'apple').map((w) => w.id);
  if (appleIds.length) await lookupMany(appleIds);
  const songs = [];
  for (const [i, w] of wanted.entries()) {
    const m = await matchWanted(w, deps);
    report(i, wanted.length, m);
    if (m.track?.preview && !songs.some((s) => s.apple === m.track.id)) songs.push(songOf(m));
  }
  console.log(JSON.stringify(songs).replace(/\},\{/g, '},\n{'));
  log(`\n${songs.length} of ${wanted.length} matched. Check every "?" line before using it.`);
}

/** The pack file in the repo's style: one song per line. */
function formatPack(p) {
  const { songs, ...head } = p;
  const top = Object.entries(head).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n');
  return `{\n${top}\n  "songs": [\n${songs.map((s) => `    ${JSON.stringify(s).replace(/":/g, '": ').replace(/,"/g, ', "')}`).join(',\n')}\n  ]\n}\n`;
}
