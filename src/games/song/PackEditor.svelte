<script lang="ts">
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Popup from '../../components/Popup.svelte';
  import ListTools from '../../components/ListTools.svelte';
  import SongForm from './SongForm.svelte';
  import { onMount, tick } from 'svelte';
  import { cachedTracks, lookupMany } from './itunes';
  import { art, type Track } from './match';
  import { songMatches, findSongs } from './find';
  import { formatStart } from './edit';
  import type { SortKey } from '../../lib/listing';
  import { customSongs, songPacks, type Song, type SongPack } from '../../lib/content';
  import { sfx } from '../../lib/sound';

  // One pack, every song listed: rename, edit, delete, and "Add songs". Every change saves at
  // once. Editing a built-in saves this phone's copy under the same id; "Restore original" drops it.
  let { id, onback, onadd }: { id: string; onback: () => void; onadd: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const builtin = customSongs.isBuiltin(id);
  // svelte-ignore state_referenced_locally
  const initial = songPacks().find((p) => p.id === id) ?? null;
  let pack = $state<SongPack | null>(initial);
  // svelte-ignore state_referenced_locally
  let edited = $state(customSongs.isEdited(id));
  let name = $state(initial?.name ?? '');
  let open = $state<number | null>(null);
  /** Album art for the list, from the phone's cache, then one batched lookup. */
  let tracks = $state(new Map<number, Track | null>());
  let confirm = $state<'' | 'restore' | 'delete'>('');
  let query = $state('');
  let sort = $state<SortKey>('suggested');
  let fresh = $state<number | null>(null);
  let list = $state<HTMLUListElement>();
  const shown = $derived(pack ? findSongs(pack.songs, query, sort) : []);

  onMount(() => {
    const ids = pack?.songs.map((s) => s.apple) ?? [];
    tracks = cachedTracks(ids);
    if (ids.some((x) => !tracks.has(x))) lookupMany(ids).then((m) => (tracks = m), () => {});
  });

  function persist(next: SongPack) {
    const { custom: _, ...plain } = next;
    customSongs.put($state.snapshot(plain));
    pack = next;
    edited = customSongs.isEdited(id);
  }

  function rename() {
    if (!pack) return;
    const n = name.trim().replace(/\s+/g, ' ');
    if (!n || n === pack.name) { name = pack.name; return; }
    persist({ ...pack, name: n });
  }

  function saveSong(song: Song) {
    if (!pack || open === null) return;
    const songs = pack.songs.map((s, i) => (i === open ? song : s));
    const at = open;
    persist({ ...pack, songs });
    open = null;
    sfx.correct();
    if (!songMatches(song, query)) query = '';
    show(at);
  }

  async function show(i: number) {
    fresh = i;
    await tick();
    list?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    setTimeout(() => { if (fresh === i) fresh = null; }, 1600);
  }

  function deleteSong(index: number) {
    if (!pack) return;
    persist({ ...pack, songs: pack.songs.filter((_, i) => i !== index) });
    open = null;
  }

  function restore() {
    customSongs.restore(id);
    pack = customSongs.original(id) ?? null;
    name = pack?.name ?? '';
    edited = false;
    confirm = '';
  }

  function deletePack() {
    customSongs.remove(id);
    confirm = '';
    onback();
  }
</script>

<Screen title={pack?.name ?? 'Pack'} {onback}>
  {#if !pack}
    <p class="muted">This pack is no longer on this phone.</p>
  {:else}
    <div class="about">
      <p class="muted">
        {#if builtin}Comes with the app{edited ? ' · edited on this phone' : ''}{:else}Your pack, on this phone only{/if}
      </p>
      {#if builtin && edited}
        <span class="act"><Button variant="secondary" size="sm" onclick={() => (confirm = 'restore')}>Restore original</Button></span>
      {:else if !builtin}
        <span class="act"><Button variant="ghost" size="sm" onclick={() => (confirm = 'delete')}>Delete pack</Button></span>
      {/if}
    </div>

    <label class="name">
      <span>Pack name</span>
      <input type="text" bind:value={name} onchange={rename} maxlength="40" autocomplete="off" enterkeyhint="done" />
    </label>

    <section class="list" aria-label="Songs">
      <ListTools key="song:songs" bind:query bind:sort placeholder="Search titles and artists" shown={shown.length} total={pack.songs.length}>
        {#snippet title()}
          <h3 class="count">{pack?.songs.length} {pack?.songs.length === 1 ? 'song' : 'songs'}</h3>
          <p class="tip">Tap one to change it</p>
        {/snippet}
      </ListTools>
      {#if query && !shown.length}<p class="none">No songs match “{query.trim()}”</p>{/if}
      {#if !pack.songs.length}<p class="none">No songs yet. Add some: paste links or a list, read a YouTube playlist, or ask Claude.</p>{/if}
      <ul class="songs" bind:this={list}>
        {#each shown as { s, i } (i)}
          {@const t = tracks.get(s.apple)}
          <li>
            <button class="song" class:fresh={fresh === i} data-i={i} onclick={() => (open = i)}>
              {#if t?.artwork}<img class="art" src={art(t.artwork, 100)} alt="" loading="lazy" />{:else}<span class="art ph" aria-hidden="true">♪</span>{/if}
              <span class="ti">{s.title}</span>
              <span class="ar">{s.artist}{s.youtube ? ' · video' : ''}{t === null ? ' · not on Apple Music' : ''}</span>
              <span class="at">{typeof s.start === 'number' ? `from ${formatStart(s.start)}` : 'auto'}</span>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#snippet actions()}
    {#if pack}<Button size="lg" onclick={onadd}>+ Add songs</Button>{/if}
  {/snippet}
</Screen>

{#if pack && open !== null && pack.songs[open]}
  {@const index = open}
  <SongForm
    song={pack.songs[index]}
    others={pack.songs.filter((_, i) => i !== index)}
    onsave={saveSong}
    ondelete={() => deleteSong(index)}
    onclose={() => (open = null)}
  />
{/if}

{#if pack && confirm === 'restore'}
  <Popup title="Restore original?" onclose={() => (confirm = '')}>
    <div class="confirm">
      <p>“{customSongs.original(id)?.name}” goes back to the songs that came with the app. Your changes to it are lost.</p>
      <Button variant="danger" onclick={restore}>Restore original</Button>
      <Button variant="secondary" onclick={() => (confirm = '')}>Keep my changes</Button>
    </div>
  </Popup>
{:else if pack && confirm === 'delete'}
  <Popup title="Delete this pack?" onclose={() => (confirm = '')}>
    <div class="confirm">
      <p>“{pack.name}” and its {pack.songs.length} songs are deleted from this phone.</p>
      <Button variant="danger" onclick={deletePack}>Delete pack</Button>
      <Button variant="secondary" onclick={() => (confirm = '')}>Keep it</Button>
    </div>
  </Popup>
{/if}

<style>
  .about { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); min-height: 44px; }
  .about p { margin: 0; }
  .act { flex: none; white-space: nowrap; }
  .name { display: flex; flex-direction: column; gap: var(--s-1); font-weight: 600; color: var(--text-dim); }
  .count { color: var(--text-dim); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; font-family: var(--font-body); font-weight: 700; }
  .list { display: flex; flex-direction: column; }
  .tip { margin: 0; color: var(--text-faint); font-size: 0.8rem; }
  .none { margin: 0 0 var(--s-3); color: var(--text-dim); }
  .songs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  .song {
    width: 100%; min-height: 64px; text-align: left; padding: var(--s-2) var(--s-4); border-radius: var(--r-md);
    border: 1.5px solid var(--line); background: var(--surface); display: grid; grid-template-columns: auto 1fr auto; column-gap: var(--s-3); align-items: center;
  }
  .art { grid-row: 1 / span 2; width: 44px; height: 44px; border-radius: var(--r-sm); object-fit: cover; background: var(--bg-sunk); }
  .ph { display: grid; place-items: center; color: var(--accent); }
  .song.fresh { animation: fresh 1.6s var(--ease-out); }
  @keyframes fresh { from { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 22%, var(--surface)); } }
  .song:active { background: color-mix(in srgb, var(--accent) 18%, var(--surface)); }
  .ti { grid-column: 2; font-family: var(--font-display); font-weight: 800; font-size: 1.1rem; line-height: 1.15; }
  .ar { grid-column: 2; color: var(--text-dim); font-weight: 600; }
  .at { grid-column: 3; grid-row: 1 / span 2; align-self: center; color: var(--text-faint); font-size: 0.8rem; font-variant-numeric: tabular-nums; }
  .confirm { display: flex; flex-direction: column; gap: var(--s-2); }
  .confirm p { margin: 0 0 var(--s-2); }
</style>
