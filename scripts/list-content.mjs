// Lists what a game's built-in packs already contain, so a new pack can avoid repeats:
//   node scripts/list-content.mjs forehead|dial|gibberish
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const game = process.argv[2];
const dir = join(import.meta.dirname, '..', 'src', 'content', game ?? '');
if (!['forehead', 'dial', 'gibberish'].includes(game)) {
  console.error('usage: node scripts/list-content.mjs forehead|dial|gibberish');
  process.exit(1);
}
const packs = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => { const d = JSON.parse(readFileSync(join(dir, f), 'utf8')); return d.packs ?? [d]; });

const hints = new Map();
for (const p of packs) {
  const items = p.words ?? p.cards;
  console.log(`\n## ${p.id} — ${p.name} (${items.length})`);
  for (const it of items) {
    if (typeof it === 'string') console.log(it);
    else if ('left' in it) console.log(`${it.left} | ${it.right}`);
    else { console.log(`${it.answer}  ←  ${it.phrase}`); hints.set(it.hint, (hints.get(it.hint) ?? 0) + 1); }
  }
}
if (hints.size) console.log('\n## hints in use\n' + [...hints].sort((a, b) => b[1] - a[1]).map(([h, n]) => `${h} (${n})`).join(', '));
