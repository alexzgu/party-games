<script lang="ts">
  import InkCard from '../../components/draw/InkCard.svelte';
  import type { Drawing } from '../../lib/ink';
  import type { AlbumItem, View } from './view';
  // One page of the Telephone album: the entry shown now, big, with the one it answered beside it.
  let { album, art }: { album: NonNullable<View['album']>; art: Record<string, Drawing> } = $props();
  const now = $derived(album.items[album.entry]);
  const before = $derived(album.entry ? album.items[album.entry - 1] : null);
  function said(x: AlbumItem, i: number): string {
    if (x.kind === 'drawing') return x.id ? `${x.by} drew` : `${x.by} drew nothing`;
    if (x.filled) return 'The game filled this in';
    return i === 0 ? `${x.by} wrote` : `${x.by} thought it was`;
  }
</script>

{#snippet entry(x: AlbumItem, i: number, big: boolean)}
  <figure class:big>
    <figcaption>{said(x, i)}</figcaption>
    {#if x.kind === 'text'}<blockquote class:filled={x.filled}>{x.text}</blockquote>
    {:else if x.id}<div class="pic"><InkCard drawing={art[x.id]} label="{x.by}’s drawing" empty="Loading drawing…" /></div>
    {:else}<div class="pic blank">Nothing was drawn</div>{/if}
  </figure>
{/snippet}

<div class="album">
  <p class="where">Chain {album.chain + 1} of {album.chains} · started by {album.starter} · {album.entry + 1} of {album.chains}</p>
  <div class="pages" class:pair={!!before}>
    {#if before}{@render entry(before, album.entry - 1, false)}{/if}
    {#key `${album.chain}.${album.entry}`}<div class="now">{@render entry(now, album.entry, true)}</div>{/key}
  </div>
</div>

<style>
  .album { display: grid; gap: var(--s-3); min-height: 0; }
  .where { color: var(--text-dim); text-align: center; }
  .pages { display: grid; gap: var(--s-3); align-items: center; justify-items: center; min-height: 0; }
  .pages.pair { grid-template-columns: minmax(0, 2fr) minmax(0, 3fr); }
  .now { width: 100%; animation: rise var(--dur) var(--ease-out) both; }
  figure { margin: 0; display: grid; gap: var(--s-2); justify-items: center; width: 100%; }
  figcaption { color: var(--text-dim); font-weight: 700; }
  blockquote { margin: 0; text-align: center; font: 800 clamp(1.1rem, calc(3.2vmin * var(--text-scale)), 2rem)/1.2 var(--font-display); overflow-wrap: anywhere; }
  .big blockquote { font-size: clamp(1.4rem, calc(5vmin * var(--text-scale)), 3rem); }
  .filled { font-style: italic; }
  .pic { width: min(100%, 52dvh); }
  .big .pic { width: min(100%, 60dvh); }
  .blank { aspect-ratio: 1; display: grid; place-items: center; border: 2px dashed var(--line-strong); border-radius: var(--r-md); color: var(--text-dim); }
  @keyframes rise { from { opacity: 0; transform: translateY(12px); } }
  @media (max-width: 560px) { .pages.pair { grid-template-columns: 1fr; } .pages.pair figure:not(.big) .pic { width: 40%; } }
</style>
