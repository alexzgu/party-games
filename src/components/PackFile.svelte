<script lang="ts">
  // The row at the end of a game's pack list: "Add pack" (a menu: New, 🌍 Community, Import) and
  // "Export" (my packs). It sits under the pack list, which scrolls above it, just over the start
  // bar (components/PackList.svelte). New is the game's make page. Import reads a pack
  // file and saves each pack in it as the player's own (never over a pack already here); export
  // sends every pack made or edited on this phone in one file. Text from a file is only ever shown
  // as text. For a game in the Community library (library.ts) Community opens the Community packs
  // over the page, at the same address plus `?community=1`, so Back closes them; a pack imported
  // there goes through `onimported` like one from a file.
  import type { PackGameId } from '../app.config';
  import Button from './Button.svelte';
  import Community from './Community.svelte';
  import MenuButton, { type MenuItem } from './MenuButton.svelte';
  import { HEAD_BYTES, importMessage, importPacks, MAX_FILE_BYTES, PACK_FILE_ACCEPT, packFile, savedPacks, tooBigMessage, type ImportResult } from '../lib/packfile';
  import { libraryOn } from '../lib/library';
  import { back, go, route } from '../lib/router.svelte';
  import { shareOrDownload } from '../lib/share';

  let { game, onmake, onimported }: { game: PackGameId; onmake: () => void; onimported?: (ids: string[]) => void } = $props();

  let input: HTMLInputElement | undefined = $state();
  // svelte-ignore state_referenced_locally
  let mine = $state(savedPacks(game).length);
  let status = $state('');
  let failed = $state(false);
  let menuOpen = $state(false);

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

  const community = $derived(libraryOn(game));
  const browsing = $derived(community && route.params.get('community') === '1');
  function openCommunity() {
    const params = new URLSearchParams(route.params);
    params.set('community', '1');
    go(`${route.path}?${params}`);
  }

  function fromCommunity(r: Exclude<ImportResult, { error: string }>) {
    say(importMessage(game, r));
    mine = savedPacks(game).length;
    onimported?.(r.saved.map((p) => p.id));
    back(route.path);
  }

  async function exportMine() {
    const packs = savedPacks(game);
    if (!packs.length) return;
    const file = packFile(game, packs);
    say((await shareOrDownload(file)) === 'saved' ? `Saved ${file.name}` : '');
  }

  const adds: MenuItem[] = $derived([
    { icon: '✨', label: 'New', name: 'New pack', onselect: onmake },
    ...(community ? [{ icon: '🌍', label: 'Community', name: 'Community packs', onselect: openCommunity }] : []),
    { icon: '📂', label: 'Import', name: 'Import packs from a file', onselect: () => input?.click() },
  ]);
</script>

<div class="packfile" class:open={menuOpen}>
  <div class="row">
    <MenuButton label="Add pack" items={adds} bind:open={menuOpen}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>Add pack
    </MenuButton>
    {#if mine}<Button variant="secondary" size="sm" label="Export my packs to a file" onclick={exportMine}>Export</Button>{/if}
  </div>
  <input bind:this={input} type="file" accept={PACK_FILE_ACCEPT} hidden onchange={chosen} aria-label="Pack file to import" />
  <p class="status" class:failed role="status">{status}</p>
</div>

{#if browsing}
  <div class="layer"><Community {game} onclose={() => back(route.path)} onimport={fromCommunity} /></div>
{/if}

<style>
  /* Relative so its open menu can rise over the page's pinned bars. */
  .packfile { position: relative; display: flex; flex-direction: column; gap: var(--s-2); padding: var(--s-2) 0; }
  /* Over the page's pinned bars while its menu is open, so a tap anywhere outside closes it. */
  .packfile.open { z-index: var(--z-raised); }
  .row { display: flex; gap: var(--s-2); }
  .row > :global(*) { flex: 1 1 0; }
  .status { margin: 0; color: var(--text-dim); font-size: 0.9rem; line-height: 1.3; overflow-wrap: anywhere; }
  .status:empty { display: none; }
  .failed { color: var(--bad-ink); font-weight: 600; }
  .layer { position: fixed; inset: 0; z-index: var(--z-overlay); overflow-y: auto; overscroll-behavior: contain; background: var(--bg); }
</style>
