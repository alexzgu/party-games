// Checks every built-in Earworm song against Apple and YouTube: each Apple track id must still
// exist with a 30-second preview (batched lookups, a few calls in all), and each YouTube id
// shown at the reveal must still be public and embeddable (oEmbed: 401/404 means it is not).
// Lists every failure; exits 1 when there is one. Needs internet.
// Usage: npm run check:songs [-- <pack-id> ...]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', 'src', 'content', 'song');
const only = process.argv.slice(2);
const packs = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
  .filter((p) => !only.length || only.includes(p.id));
const songs = packs.flatMap((p) => p.songs.map((s) => ({ ...s, pack: p.id })));
const name = (s) => `${s.pack}: "${s.title}" — ${s.artist}`;

async function json(url) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url).catch((e) => ({ ok: false, status: 0, why: e.cause?.code ?? e.message }));
    if (res.ok) return res.json();
    if (attempt < 2 && (res.status === 0 || res.status === 403 || res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 20_000));
      continue;
    }
    throw new Error(`HTTP ${res.status || res.why}`);
  }
}

const bad = [];

// Apple: 50 ids per lookup, a few seconds apart (Apple allows about 20 calls a minute).
const ids = [...new Set(songs.map((s) => s.apple))];
const found = new Map();
for (let i = 0; i < ids.length; i += 50) {
  if (i) await new Promise((r) => setTimeout(r, 3500));
  const j = await json(`https://itunes.apple.com/lookup?id=${ids.slice(i, i + 50).join(',')}&country=US`);
  for (const r of j.results ?? []) if (r.kind === 'song') found.set(r.trackId, r);
}
for (const s of songs) {
  const t = found.get(s.apple);
  if (!t) bad.push(`✗ ${name(s)} [apple ${s.apple}]: Apple has no such song in the US store`);
  else if (!t.previewUrl) bad.push(`✗ ${name(s)} [apple ${s.apple}]: Apple has no preview for it`);
}

// YouTube (reveal only): oEmbed per video, six at a time.
const videos = songs.filter((s) => s.youtube);
const queue = [...videos];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const s = queue.shift();
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${s.youtube}`)}&format=json`).catch(() => null);
    if (!res) bad.push(`? ${name(s)} [video ${s.youtube}]: YouTube did not answer`);
    else if (res.status === 401 || res.status === 404) bad.push(`✗ ${name(s)} [video ${s.youtube}]: ${res.status === 401 ? 'embedding turned off' : 'video not found'} (remove "youtube" or pick another video)`);
  }
}));

console.log(`${songs.length} songs: ${songs.length - bad.filter((b) => b.includes('[apple')).length} play from Apple; ${videos.length} have a YouTube video for the reveal.`);
for (const b of bad) console.log(b);
process.exit(bad.some((b) => b.startsWith('✗')) ? 1 : 0);
