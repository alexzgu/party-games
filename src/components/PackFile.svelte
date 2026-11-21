<script lang="ts">
  // "Import packs" and "Export my packs" for a game's pack list. Import reads a pack file and
  // saves each pack in it as the player's own (never over a pack already here); export sends
  // every pack made or edited on this phone in one file. Text from a file is only ever shown as text.
  import type { PackGameId } from '../app.config';
  import Button from './Button.svelte';
  import { HEAD_BYTES, importMessage, importPacks, MAX_FILE_BYTES, PACK_FILE_ACCEPT, packFile, savedPacks, tooBigMessage } from '../lib/packfile';
  import { shareOrDownload } from '../lib/share';

  let { game, onimported }: { game: PackGameId; onimported?: (ids: string[]) => void } = $props();

  let input: HTMLInputElement | undefined = $state();
  // svelte-ignore state_referenced_locally
  let mine = $state(savedPacks(game).length);
  let status = $state('');
  let failed = $state(false);

  const say = (msg: string, bad = false) => { status = msg; failed = bad; };

  async function chosen(e: Event & { currentTarget: HTMLInputElement }) {
    const f = e.currentTarget.files?.[0];
    e.currentTarget.value = ''; // the same file can be picked again
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) return say(tooBigMessage(await f.slice(0, HEAD_BYTES).text().catch(() => '')), true);
    let content: string;
    try { content = await f.text(); } catch { return say('That file could not be read.', true); }
    const r = importPacks(game, content);
    if ('error' in r) return say(r.error, true);
    say(importMessage(game, r));
    mine = savedPacks(game).length;
    onimported?.(r.saved.map((p) => p.id));
  }

  async function exportMine() {
    const packs = savedPacks(game);
    if (!packs.length) return;
    const file = packFile(game, packs);
    say((await shareOrDownload(file)) === 'saved' ? `Saved ${file.name}` : '');
  }
</script>

<div class="packfile">
  <div class="row">
    <Button variant="secondary" size="sm" onclick={() => input?.click()}>Import packs</Button>
    {#if mine}<Button variant="secondary" size="sm" onclick={exportMine}>Export my packs</Button>{/if}
  </div>
  <input bind:this={input} type="file" accept={PACK_FILE_ACCEPT} hidden onchange={chosen} aria-label="Pack file to import" />
  <p class="status" class:failed role="status">{status}</p>
</div>

<style>
  .packfile { display: flex; flex-direction: column; gap: var(--s-2); margin-top: var(--s-3); }
  .row { display: flex; flex-wrap: wrap; gap: var(--s-2); }
  .status { margin: 0; color: var(--text-dim); font-size: 0.9rem; line-height: 1.3; overflow-wrap: anywhere; }
  .status:empty { display: none; }
  .failed { color: var(--bad-ink); font-weight: 600; }
</style>
