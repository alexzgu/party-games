<script lang="ts">
  import { onMount } from 'svelte';
  import Popup from '../../components/Popup.svelte';
  import Button from '../../components/Button.svelte';
  import StartPicker from './StartPicker.svelte';
  import type { Song } from '../../lib/content';
  import { checkSong } from './edit';
  import { lookup } from './itunes';
  import { art, type Track } from './match';

  // Change one song: the title and artist players see, where its clip starts, and an optional
  // YouTube video for the reveal. The Apple Music track (the sound) stays; a wrong one is
  // deleted here and added again from "Add songs".
  let { song, others, hasClip = false, onsave, ondelete, onclose }: {
    song: Song;
    /** It plays from a clip on this phone (a clip pack), cut at its moment when the pack was made. */
    hasClip?: boolean;
    /** The pack's other songs, so a title is never in it twice. */
    others: Song[];
    onsave: (song: Song) => void;
    ondelete: () => void;
    onclose: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let title = $state(song.title);
  // svelte-ignore state_referenced_locally
  let artist = $state(song.artist);
  // svelte-ignore state_referenced_locally
  let youtube = $state(song.youtube ? `https://youtu.be/${song.youtube}` : '');
  // svelte-ignore state_referenced_locally
  let start = $state<number | null>(typeof song.start === 'number' ? song.start : null);
  let track = $state<Track | null>(null);
  let looked = $state(false);
  let error = $state('');
  let deleting = $state(false);
  // svelte-ignore state_referenced_locally
  const was = { title, artist, youtube, start };
  const dirty = $derived(title !== was.title || artist !== was.artist || youtube !== was.youtube || start !== was.start);
  /** ✕, Escape or a tap outside with unsaved changes (a hand-set start, say) asks first. */
  let discarding = $state(false);
  function tryClose() {
    if (dirty && !discarding) discarding = true;
    else onclose();
  }

  onMount(() => {
    if (!song.apple) { looked = true; return; }
    lookup(song.apple).then((t) => (track = t), () => (track = null)).finally(() => (looked = true));
  });

  function save(e: SubmitEvent) {
    e.preventDefault();
    const r = checkSong({ title, artist, youtube, start }, song, others);
    if (r.song) onsave(r.song);
    else error = r.error;
  }
</script>

<Popup title="Edit song" onclose={tryClose}>
  <form class="form" onsubmit={save} oninput={() => (error = '')}>
    {#if discarding}
      <div class="discard" role="alert">
        <p>Discard your changes to this song?</p>
        <Button variant="danger" onclick={onclose}>Discard changes</Button>
        <Button variant="secondary" onclick={() => (discarding = false)}>Keep editing</Button>
      </div>
    {/if}
    <div class="source">
      {#if track?.artwork}<img src={art(track.artwork, 120)} alt="" />{:else}<span class="ph" aria-hidden="true">♪</span>{/if}
      <p>
        {#if song.clipOnly}<b>Clip only</b><span>Not on Apple Music; it plays from its clip {hasClip ? 'on this phone' : 'in its clip pack, which this phone doesn’t have'}.</span>
        {:else if track}<b>{track.title}</b><span>{track.artist} · Apple Music{hasClip ? ' · plays from its clip on this phone' : ''}</span>
        {:else if looked}<b>Not found on Apple Music</b><span>Delete it and add it again from “Add songs”.</span>
        {:else}<b>Looking it up…</b><span>&nbsp;</span>{/if}
      </p>
    </div>
    <label>
      <span>Title (what players shout)</span>
      <input type="text" bind:value={title} maxlength="80" autocomplete="off" />
    </label>
    <label>
      <span>Artist</span>
      <input type="text" bind:value={artist} maxlength="60" autocomplete="off" />
    </label>
    {#if looked && !song.clipOnly}<StartPicker {track} bind:start />{/if}
    {#if !song.clipOnly}
      <label>
        <span>YouTube video for the reveal (optional)</span>
        <input type="text" inputmode="url" bind:value={youtube} placeholder="https://youtu.be/…" autocomplete="off" autocapitalize="off" spellcheck="false" />
      </label>
    {/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <Button type="submit" size="lg" guardMs={0}>Save song</Button>
    <Button variant={deleting ? 'danger' : 'ghost'} guardMs={0} onclick={() => (deleting ? ondelete() : (deleting = true))}>
      {deleting ? 'Tap again to delete this song' : 'Delete song'}
    </Button>
  </form>
</Popup>

<style>
  .form { display: flex; flex-direction: column; gap: var(--s-3); }
  label { display: flex; flex-direction: column; gap: var(--s-1); font-weight: 600; color: var(--text-dim); }
  .source { display: flex; align-items: center; gap: var(--s-3); }
  .source img, .ph { width: 56px; height: 56px; border-radius: var(--r-sm); flex: none; object-fit: cover; background: var(--bg-sunk); }
  .ph { display: grid; place-items: center; color: var(--accent); font-size: 1.4rem; }
  .source p { margin: 0; display: flex; flex-direction: column; min-width: 0; }
  .source b { font-family: var(--font-display); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .source span { color: var(--text-faint); font-size: 0.85rem; }
  .discard { display: flex; flex-direction: column; gap: var(--s-2); padding: var(--s-3); border-radius: var(--r-md); background: var(--surface); border: 1.5px solid var(--line-strong); }
  .discard p { margin: 0; font-weight: 700; }
  .error {
    margin: 0; padding: var(--s-3) var(--s-4); border-radius: var(--r-md); font-weight: 600;
    background: color-mix(in srgb, var(--c-bad) 18%, var(--surface)); border: 1.5px solid color-mix(in srgb, var(--c-bad) 60%, transparent);
  }
</style>
