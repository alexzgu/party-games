// Asks YouTube whether every Earworm song can play inside another site (embedding allowed),
// using the public oEmbed endpoint: 401 or 404 means it cannot. Lists every failure; exits 1
// when there is one. Needs internet. Usage: npm run check:songs [-- <pack-id> ...]
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(import.meta.dirname, '..', 'src', 'content', 'song');
const only = process.argv.slice(2);
const packs = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
  .filter((p) => !only.length || only.includes(p.id));
const songs = packs.flatMap((p) => p.songs.map((s) => ({ ...s, pack: p.id })));

async function check(s) {
  const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${s.youtube}`)}&format=json`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return { s, ok: true };
      if (res.status === 401 || res.status === 404) return { s, ok: false, why: res.status === 401 ? 'embedding turned off' : 'video not found' };
      if (res.status !== 429 && res.status < 500) return { s, ok: false, why: `HTTP ${res.status}` };
    } catch (e) {
      if (attempt === 2) return { s, ok: false, why: `no answer (${e.cause?.code ?? e.message})` };
    }
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  return { s, ok: false, why: 'YouTube kept refusing; try again later' };
}

const results = [];
const queue = [...songs];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) results.push(await check(queue.shift()));
}));

const bad = results.filter((r) => !r.ok);
console.log(`${songs.length - bad.length} of ${songs.length} songs can play in the game.`);
for (const { s, why } of bad) console.log(`✗ ${s.pack}: "${s.title}" — ${s.artist} [${s.youtube}]: ${why}`);
process.exit(bad.length ? 1 : 0);
