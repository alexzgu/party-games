<script lang="ts">
  import Popup from '../../components/Popup.svelte';
  import Button from '../../components/Button.svelte';
  import type { Song } from '../../lib/content';
  import { checkSong, formatStart } from './edit';

  // Add or edit one song: title, artist, a YouTube link and the second the clip starts at.
  let { song, others, onsave, ondelete, onclose }: {
    song: Song | null;
    /** The pack's other songs, so a video or title is never in it twice. */
    others: Song[];
    onsave: (song: Song) => void;
    ondelete?: () => void;
    onclose: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let title = $state(song?.title ?? '');
  // svelte-ignore state_referenced_locally
  let artist = $state(song?.artist ?? '');
  // svelte-ignore state_referenced_locally
  let link = $state(song ? `https://youtu.be/${song.youtube}` : '');
  // svelte-ignore state_referenced_locally
  let start = $state(song ? formatStart(song.start) : '');
  let error = $state('');
  let deleting = $state(false);

  function save(e: SubmitEvent) {
    e.preventDefault();
    const r = checkSong({ title, artist, link, start }, others);
    if (r.song) onsave(r.song);
    else error = r.error;
  }
</script>

<Popup title={song ? 'Edit song' : 'New song'} {onclose}>
  <form class="form" onsubmit={save} oninput={() => (error = '')}>
    <label>
      <span>Title</span>
      <input type="text" bind:value={title} placeholder="Mr. Brightside" maxlength="80" autocomplete="off" />
    </label>
    <label>
      <span>Artist</span>
      <input type="text" bind:value={artist} placeholder="The Killers" maxlength="60" autocomplete="off" />
    </label>
    <label>
      <span>YouTube link</span>
      <input type="text" inputmode="url" bind:value={link} placeholder="https://youtu.be/…" autocomplete="off" autocapitalize="off" spellcheck="false" />
    </label>
    <label>
      <span>Clip starts at (the catchiest part)</span>
      <input type="text" bind:value={start} placeholder="1:05 (empty: from the link's time, or 0:00)" inputmode="numeric" autocomplete="off" />
    </label>
    <p class="tip">Use the official video or official audio. Some videos can't play inside other apps; the game skips those by itself.</p>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <Button type="submit" size="lg" guardMs={0}>{song ? 'Save song' : 'Add song'}</Button>
    {#if ondelete}
      <Button variant={deleting ? 'danger' : 'ghost'} guardMs={0} onclick={() => (deleting ? ondelete() : (deleting = true))}>
        {deleting ? 'Tap again to delete this song' : 'Delete song'}
      </Button>
    {/if}
  </form>
</Popup>

<style>
  .form { display: flex; flex-direction: column; gap: var(--s-3); }
  label { display: flex; flex-direction: column; gap: var(--s-1); font-weight: 600; color: var(--text-dim); }
  .tip { margin: 0; color: var(--text-faint); font-size: 0.85rem; }
  .error {
    margin: 0; padding: var(--s-3) var(--s-4); border-radius: var(--r-md); font-weight: 600;
    background: color-mix(in srgb, var(--c-bad) 18%, var(--surface)); border: 1.5px solid color-mix(in srgb, var(--c-bad) 60%, transparent);
  }
</style>
