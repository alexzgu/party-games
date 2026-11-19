// Lists what a game's built-in packs already contain, so a new pack can avoid repeats:
//   node scripts/list-content.mjs forehead|dial|gibberish|quiz|taboo|quick|snark|song
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const game = process.argv[2];
const dir = join(import.meta.dirname, '..', 'src', 'content', game ?? '');
if (!['forehead', 'dial', 'gibberish', 'quiz', 'taboo', 'quick', 'snark', 'song'].includes(game)) {
  console.error('usage: node scripts/list-content.mjs forehead|dial|gibberish|quiz|taboo|quick|snark|song');
  process.exit(1);
}
const packs = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => { const d = JSON.parse(readFileSync(join(dir, f), 'utf8')); return d.packs ?? [d]; });

const hints = new Map();
for (const p of packs) {
  if (p.categories) {
    // A Big Board: its categories, then each clue's answer (easiest first).
    console.log(`\n## ${p.id} — ${p.name} (${p.categories.length} × ${p.categories[0]?.clues.length ?? 0})`);
    for (const c of p.categories) {
      console.log(`\n### ${c.name}`);
      for (const k of c.clues) console.log(`${k.answer}  ←  ${k.clue}`);
    }
    continue;
  }
  const items = p.words ?? p.cards ?? p.prompts ?? p.songs;
  console.log(`\n## ${p.id} — ${p.name} (${items.length})`);
  for (const it of items) {
    if (typeof it === 'string') console.log(it);
    else if ('left' in it) console.log(`${it.left} | ${it.right}`);
    else if ('apple' in it) console.log(`${it.title} — ${it.artist}  [apple ${it.apple}${it.start !== undefined ? `, from ${it.start}s` : ''}${it.youtube ? `, video ${it.youtube}` : ''}]`);
    else if ('banned' in it) console.log(`${it.word}: ${it.banned.join(', ')}`);
    else { console.log(`${it.answer}  ←  ${it.phrase}`); hints.set(it.hint, (hints.get(it.hint) ?? 0) + 1); }
  }
}
if (hints.size) console.log('\n## hints in use\n' + [...hints].sort((a, b) => b[1] - a[1]).map(([h, n]) => `${h} (${n})`).join(', '));
