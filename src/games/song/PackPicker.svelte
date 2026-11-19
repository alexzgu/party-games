<script lang="ts">
  import ListTools from '../../components/ListTools.svelte';
  import { customSongs, type SongPack } from '../../lib/content';
  import type { SortKey } from '../../lib/listing';
  import { sfx } from '../../lib/sound';
  import { findPacks } from './find';

  // Multi-select pack tiles. Tapping a tile ticks it; the pencil opens the pack to see, edit or
  // delete its songs. Search and sort only change what is shown: hidden ticks still count.
  let { packs, selected = $bindable(), onnew, onedit }: {
    packs: SongPack[];
    selected: string[];
    onnew: () => void;
    onedit: (packId: string) => void;
  } = $props();

  // Taps this soon after the list appears are the tail of the tap that opened it.
  const shownAt = performance.now();

  function toggle(id: string) {
    if (performance.now() - shownAt < 400) return;
    selected = selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id];
    sfx.tap();
  }

  let query = $state('');
  let sort = $state<SortKey>('suggested');
  const shown = $derived(findPacks(packs, query, sort));

  const tag = (p: SongPack) => (p.custom ? ' · Mine' : customSongs.isEdited(p.id) ? ' · Edited' : '');
</script>

<section class="packs" aria-labelledby="packs-h">
  <ListTools key="song:packs" bind:query bind:sort placeholder="Search packs, songs, artists" shown={shown.length} total={packs.length}>
    {#snippet title()}<h3 id="packs-h">Packs</h3>{/snippet}
  </ListTools>
  {#if query && !shown.length}<p class="none">No packs match “{query.trim()}”</p>{/if}
  <ul class="grid">
    {#each shown as { p, hit } (p.id)}
      {@const on = selected.includes(p.id)}
      <li>
        <button class="tile" class:on aria-pressed={on} onclick={() => toggle(p.id)}>
          <span class="check" aria-hidden="true">{on ? '✓' : ''}</span>
          <span class="name">{p.name}</span>
          <span class="blurb">{p.blurb}</span>
          {#if hit}<span class="hit">{hit}</span>{/if}
          <span class="meta">{p.songs.length} songs{tag(p)}</span>
        </button>
        <button class="edit" onclick={() => onedit(p.id)} aria-label="See and edit {p.name}">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg>
        </button>
      </li>
    {/each}
    <li>
      <button class="tile make" onclick={onnew}>
        <span class="spark" aria-hidden="true">＋</span>
        <span class="name wide">New pack</span>
        <span class="blurb">Add songs from YouTube links</span>
      </button>
    </li>
  </ul>
</section>

<style>
  .packs { display: flex; flex-direction: column; }
  .none { margin: 0 0 var(--s-3); color: var(--text-dim); }
  .grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-2); }
  li { position: relative; }
  .tile {
    width: 100%; height: 100%; min-height: 112px; text-align: left; padding: var(--s-3); border-radius: var(--r-md);
    border: 2px solid var(--line); background: var(--surface); display: flex; flex-direction: column; gap: 2px;
    transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast) ease, background var(--dur-fast) ease;
  }
  .tile:active { transform: scale(0.97); }
  .tile.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 18%, var(--surface)); }
  .check {
    position: absolute; top: 10px; right: 10px; width: 26px; height: 26px; border-radius: 50%;
    border: 2px solid var(--line-strong); display: grid; place-items: center; font-weight: 900; font-size: 0.9rem;
  }
  .tile.on .check { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
  .name { font-family: var(--font-display); font-weight: 800; font-size: 1.15rem; line-height: 1.1; padding-right: 30px; }
  .name.wide { padding-right: 0; }
  .blurb { color: var(--text-dim); font-size: 0.85rem; line-height: 1.25; flex: 1; }
  .hit { color: var(--text-faint); font-size: 0.8rem; font-style: italic; line-height: 1.25; overflow-wrap: anywhere; }
  .meta { color: var(--text-faint); font-size: 0.8rem; font-weight: 600; padding-right: 40px; min-height: 30px; display: flex; align-items: flex-end; }
  .make { border-style: dashed; border-color: color-mix(in srgb, var(--accent) 55%, transparent); background: transparent; }
  .spark { font-size: 1.4rem; font-weight: 800; color: var(--accent); }
  .edit {
    position: absolute; bottom: 2px; right: 2px; width: 48px; height: 48px; padding: 0;
    border: 0; background: transparent; color: var(--text-dim); display: grid; place-items: center;
  }
  .edit::before {
    content: ''; position: absolute; inset: 7px; border-radius: 50%;
    background: var(--overlay); border: 1.5px solid var(--line-strong);
  }
  .edit svg { position: relative; }
  .edit:active::before { background: color-mix(in srgb, var(--accent) 30%, var(--surface)); }
</style>
