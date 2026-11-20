<script lang="ts">
  import { onMount } from 'svelte';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import FoundRow from './FoundRow.svelte';
  import { Adder, rematchWanted, toSong, type Item } from './adding';
  import { parsePaste, tidy, wantedKey, youtubeFrom, type Track } from './match';
  import { apple, deps } from './itunes';
  import { readPlaylist } from './youtube';
  import { spotifyTitle } from './spotify';
  import { askClaude, COUNT_RANGE, DEFAULT_COUNT } from './generate';
  import { loadAdding, saveAdding } from './store';
  import { hasKey, NOT_HERE } from '../../lib/claude';
  import WizardEffort from '../../components/WizardEffort.svelte';
  import { customSongs, songPacks, type SongPack } from '../../lib/content';
  import { sfx } from '../../lib/sound';

  // Adding songs to one pack: paste lines (YouTube, Apple Music or Spotify song links, or
  // "Title - Artist"), read a YouTube playlist, or ask the wizard (Claude) for a theme. Every line is matched to an Apple Music song as it
  // comes in and listed for review; nothing is saved to the pack until "Add N songs". The list itself is kept
  // on the phone, so a reload carries on where it was.
  let { id, onback }: { id: string; onback: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const pack: SongPack | null = songPacks().find((p) => p.id === id) ?? null;
  let mode = $state<'paste' | 'playlist' | 'claude'>('paste');
  let text = $state('');
  let link = $state('');
  let theme = $state('');
  let count = $state(DEFAULT_COUNT);
  let problem = $state('');
  let asking = $state(false);
  let items = $state<Item[]>([]);
  let busy = $state(false);
  let waiting = $state(0);
  let error = $state('');
  let playing = $state('');
  let audio: HTMLAudioElement | null = null;
  let abort: AbortController | null = null;

  // svelte-ignore state_referenced_locally
  const adder = new Adder({ ...deps, spotifyTitle, readPlaylist }, pack?.songs ?? [], changed, loadAdding<Item[]>(id, []));

  function changed() {
    items = adder.items.map((i) => ({ ...i }));
    busy = adder.busy;
    waiting = adder.waiting;
    error = adder.error;
    saveAdding(id, adder.items.length ? adder.items : null);
  }

  onMount(() => {
    changed();
    if (adder.waiting) adder.resume();
    return close;
  });

  const done = $derived(items.filter((i) => i.state === 'done' && i.wanted.kind !== 'playlist').length);
  const total = $derived(items.filter((i) => i.wanted.kind !== 'playlist').length);
  const keep = $derived(items.filter((i) => i.keep && i.match?.track?.preview && !i.dup).length);
  const doubts = $derived(items.filter((i) => i.state === 'done' && i.keep && i.match && !i.match.sure).length);
  const eta = $derived(busy && total > done ? apple.etaSeconds(total - done) : 0);

  function find() {
    const lines = parsePaste(text);
    if (!lines.length) { problem = 'Paste at least one link or “Title - Artist” line.'; return; }
    const added = adder.add(lines);
    problem = added ? '' : 'Those are already in the list below.';
    if (added) text = '';
  }

  function playlist() {
    const yt = youtubeFrom(link.trim());
    if (!yt?.list) { problem = 'That isn’t a YouTube playlist link. It should have “list=” in it.'; return; }
    problem = '';
    adder.add([{ kind: 'playlist', list: yt.list, line: link.trim() }]);
    link = '';
  }

  async function claude() {
    problem = '';
    asking = true;
    abort = new AbortController();
    const avoid = [...(pack?.songs ?? []).map((s) => `${s.title} | ${s.artist}`), ...adder.kept().map((i) => i.wanted.line)];
    const signal = abort.signal;
    let heard = 0;
    try {
      await askClaude({ theme, count, avoid, signal, onSong: (w) => { heard++; adder.add([w]); } });
      if (!heard && !signal.aborted) problem = 'Fizzwick came back empty-handed. Try again, or reword the theme.';
    } catch (e) {
      problem = (e as Error).message;
    } finally {
      asking = false;
      abort = null;
    }
  }

  function preview(url: string) {
    audio?.pause();
    if (playing === url) { playing = ''; return; }
    audio = new Audio(url);
    audio.onended = () => (playing = '');
    playing = url;
    audio.play().catch(() => (playing = ''));
  }

  const legacy = (pack?.legacySongs ?? []).map(rematchWanted);

  function close() {
    adder.close();
    abort?.abort();
    audio?.pause();
  }

  function leave() {
    close();
    onback();
  }

  function save() {
    if (!pack) return;
    const kept = adder.kept();
    const fresh = kept.map((i) => toSong(i, tidy)).filter((s) => !!s);
    const matched = new Set(kept.map((i) => i.key));
    const remaining = pack.legacySongs?.filter((song) => !matched.has(wantedKey(rematchWanted(song))));
    const { custom: _, ...plain } = pack;
    customSongs.put({ ...plain, songs: [...fresh, ...pack.songs], legacySongs: remaining });
    sfx.correct();
    close();
    saveAdding(id, null);
    onback();
  }

  function discard() {
    adder.stop();
    abort?.abort();
    adder.items = [];
    changed();
  }

  const MODES = [
    { value: 'paste' as const, label: 'Paste' },
    { value: 'playlist' as const, label: 'Playlist' },
    { value: 'claude' as const, label: '🧙 Ask the wizard' },
  ];
</script>

<Screen title="Add songs" onback={leave}>
  {#if !pack}
    <p class="muted">This pack is no longer on this phone.</p>
  {:else}
    <p class="to">To “{pack.name}” · {pack.songs.length} songs now</p>
    {#if legacy.length}
      <Button variant="secondary" onclick={() => adder.add(legacy)}>Rematch saved songs ({legacy.length})</Button>
    {/if}
    <Segmented bind:value={mode} options={MODES} label="How to add songs" onchange={() => (problem = '')} />

    {#if mode === 'paste'}
      <label class="field">
        <span>One per line: YouTube, Apple Music or Spotify song links, or “Title - Artist”. Lists copied from a chat work too.</span>
        <textarea bind:value={text} rows="6" placeholder={'https://youtu.be/…\nMr. Brightside - The Killers\nhttps://open.spotify.com/track/…\nhttps://music.apple.com/us/album/…?i=…'} autocapitalize="off" spellcheck="false"></textarea>
      </label>
      <Button onclick={find} disabled={!text.trim()}>Find these songs</Button>
    {:else if mode === 'playlist'}
      <label class="field">
        <span>A public or unlisted YouTube playlist (up to 200 songs).</span>
        <input type="text" inputmode="url" bind:value={link} placeholder="https://www.youtube.com/playlist?list=…" autocomplete="off" autocapitalize="off" spellcheck="false" />
      </label>
      <Button onclick={playlist} disabled={!link.trim()}>Read the playlist</Button>
    {:else if hasKey()}
      <label class="field">
        <span>Theme</span>
        <input type="text" bind:value={theme} maxlength="120" placeholder="songs everyone screams at a wedding" autocomplete="off" />
      </label>
      <Stepper label="How many" bind:value={count} min={COUNT_RANGE[0]} max={COUNT_RANGE[1]} step={5} />
      <WizardEffort />
      {#if asking}
        <p class="waiting" role="status"><span class="dot" aria-hidden="true"></span> Fizzwick is conjuring “{theme.trim()}” songs…</p>
        <Button variant="secondary" onclick={() => abort?.abort()}>Stop</Button>
      {:else}
        <Button onclick={claude} disabled={!theme.trim()}>✨ Conjure songs</Button>
      {/if}
    {:else}
      <div class="nokey">
        <p><b>{NOT_HERE}</b> Or ask any chatbot app:</p>
        <p class="quote">“List 30 songs everyone screams at a wedding, one per line as Title - Artist.”</p>
        <p>Then copy its answer, come back and paste it under <b>Paste</b>.</p>
        <Button variant="secondary" onclick={() => (mode = 'paste')}>Go to Paste</Button>
      </div>
    {/if}
    {#if problem}<p class="problem" role="alert">{problem}</p>{/if}

    {#if items.length}
      <section class="found" aria-label="Songs found">
        <div class="status" aria-live="polite">
          <p>
            {#if busy}<span class="dot" aria-hidden="true"></span>{/if}
            <b>Matched {done} of {total}</b>{#if eta > 20} · about {eta < 90 ? '1 minute' : `${Math.round(eta / 60)} minutes`} left{/if}
            {#if doubts} · <span class="doubt">{doubts} to check</span>{/if}
          </p>
          {#if busy}
            <button class="link" onclick={() => adder.stop()}>Pause</button>
          {:else if waiting}
            <button class="link" onclick={() => adder.resume()}>{error ? 'Try again' : 'Carry on'}</button>
          {/if}
        </div>
        {#if error}<p class="problem" role="alert">{error}</p>{/if}
        <ul class="list">
          {#each items as it (it.key)}
            <FoundRow item={it} {playing} onpreview={preview} ontoggle={() => adder.toggle(it.key)} onchoose={(t: Track) => adder.choose(it.key, t)} />
          {/each}
        </ul>
        <button class="link discard" onclick={discard}>Clear this list</button>
      </section>
    {/if}
  {/if}

  {#snippet actions()}
    {#if pack && items.length}<Button size="lg" onclick={save} disabled={keep === 0}>{keep ? `Add ${keep} ${keep === 1 ? 'song' : 'songs'}` : 'Nothing kept yet'}</Button>{/if}
  {/snippet}
</Screen>

<style>
  .to { margin: 0; color: var(--text-dim); font-weight: 600; }
  .field { display: flex; flex-direction: column; gap: var(--s-1); font-weight: 600; color: var(--text-dim); }
  textarea { min-height: 9rem; resize: vertical; font: inherit; }
  .problem { margin: 0; color: var(--c-pass); font-weight: 600; }
  .nokey { display: flex; flex-direction: column; gap: var(--s-2); padding: var(--s-4); border-radius: var(--r-md); background: var(--surface); }
  .nokey p { margin: 0; color: var(--text-dim); }
  .quote { font-style: italic; color: var(--text) !important; }
  .waiting { margin: 0; color: var(--text-dim); font-weight: 600; }
  .found { display: flex; flex-direction: column; align-items: stretch; gap: var(--s-2); min-width: 0; }
  .status { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); position: sticky; top: 0; z-index: 2; padding: var(--s-2) 0; background: var(--bg); }
  .status p { margin: 0; color: var(--text-dim); }
  .status b { color: var(--text); }
  .doubt { color: var(--c-pass); font-weight: 700; }
  .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: var(--accent); margin-right: 6px; animation: blink 1s ease-in-out infinite; }
  .list { margin: 0; padding: 0; display: flex; flex-direction: column; align-items: stretch; gap: var(--s-2); min-width: 0; }
  .link { border: 0; background: none; color: var(--accent); font-weight: 700; min-height: 44px; padding: 0 var(--s-2); }
  .discard { align-self: center; color: var(--text-dim); }
  @keyframes blink { 50% { opacity: 0.3; } }
  @media (prefers-reduced-motion: reduce) { .dot { animation: none; } }
</style>
