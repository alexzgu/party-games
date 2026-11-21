<script lang="ts">
  import { onMount } from 'svelte';
  import { ClipPlayer, autoStart, loadPreview, unlockMusic } from './audio';
  import { analyse, loudnessBars, mixDown } from './pick';
  import { formatStart, latestHandStart } from './edit';
  import { CLIPS } from './logic';
  import type { Track } from './match';

  // Where the clip starts: the preview's loudness drawn as bars; tap the strip to put the start
  // there, play 2, 5 or 10 seconds to hear it, or "Auto" to let the game pick again.
  let { track, start = $bindable() }: {
    track: Track | null;
    /** Seconds into the preview; null = picked automatically. */
    start: number | null;
  } = $props();

  const BARS = 60;
  let bars = $state<number[]>([]);
  let duration = $state(30);
  let auto = $state<number | null>(null);
  let problem = $state('');
  let buffer: AudioBuffer | null = null;
  const player = new ClipPlayer();
  let playing = $state(0);
  let progress = $state(0);

  onMount(() => {
    void load();
    return () => player.stop();
  });

  async function load() {
    if (!track?.preview) { problem = 'Apple has no preview for this song.'; return; }
    try {
      buffer = await loadPreview(track.preview);
      duration = buffer.duration;
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer!.getChannelData(i));
      bars = loudnessBars(analyse(mixDown(channels), buffer.sampleRate), BARS);
      auto = autoStart(track.id, buffer);
    } catch {
      problem = 'Couldn’t load the preview. Check the internet connection.';
    }
  }

  const at = $derived(start ?? auto ?? 0);
  const pct = (s: number) => `${(Math.min(s, duration) / duration) * 100}%`;

  function place(e: PointerEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    start = Math.round(Math.min(f * duration, latestHandStart(duration)) * 10) / 10;
    hear(CLIPS[0]);
  }

  function key(e: KeyboardEvent) {
    const d = e.key === 'ArrowLeft' ? -0.5 : e.key === 'ArrowRight' ? 0.5 : 0;
    if (!d) return;
    e.preventDefault();
    start = Math.round(Math.min(Math.max(0, at + d), latestHandStart(duration)) * 10) / 10;
  }

  function hear(seconds: number) {
    if (!buffer) return;
    unlockMusic();
    if (playing === seconds) { player.stop(); playing = 0; return; }
    playing = seconds;
    progress = 0;
    player.play(buffer, at, seconds, { progress: (f) => (progress = f), ended: () => (playing = 0) });
  }
</script>

<div class="picker">
  <p class="head">
    <span>Clip starts at <b>{formatStart(at)}</b></span>
    <span class="how">{start === null ? 'picked by the game' : 'set by hand'}</span>
  </p>
  {#if problem}
    <p class="problem">{problem}</p>
  {:else}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="strip" role="slider" tabindex="0" aria-label="Clip start in the preview" aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={at} aria-valuetext={formatStart(at)} onpointerdown={place} onkeydown={key}>
      {#if !bars.length}<span class="wait">Loading the preview…</span>{/if}
      {#each bars as h, i (i)}<span class="bar" style:height="{h * 100}%"></span>{/each}
      {#if bars.length}
        <span class="zone z10" style:left={pct(at)} style:width={pct(CLIPS[2])}></span>
        <span class="zone z5" style:left={pct(at)} style:width={pct(CLIPS[1])}></span>
        <span class="zone z2" style:left={pct(at)} style:width={pct(CLIPS[0])}></span>
        {#if playing}<span class="head-line" style:left={pct(at + progress * playing)}></span>{/if}
        <span class="mark" style:left={pct(at)}></span>
      {/if}
    </div>
    <p class="tip">Tap the strip where the clip should start. Taller bars are louder.</p>
    <div class="row">
      {#each CLIPS as s (s)}
        <button type="button" class="hear" class:on={playing === s} disabled={!bars.length} onclick={() => hear(s)}>{playing === s ? '■' : '▶'} {s} s</button>
      {/each}
      <button type="button" class="hear auto" disabled={start === null} onclick={() => (start = null)}>Auto</button>
    </div>
  {/if}
</div>

<style>
  .picker { display: flex; flex-direction: column; gap: var(--s-2); }
  .head { margin: 0; display: flex; justify-content: space-between; align-items: baseline; gap: var(--s-2); color: var(--text-dim); font-weight: 600; }
  .head b { color: var(--text); font-variant-numeric: tabular-nums; }
  .how { font-size: 0.85rem; color: var(--text-faint); }
  .strip {
    position: relative; height: 76px; display: flex; align-items: flex-end; gap: 1px; padding: 6px 4px;
    border-radius: var(--r-md); background: var(--bg-sunk); border: 1.5px solid var(--line); cursor: pointer; touch-action: none; overflow: hidden;
  }
  .strip:focus-visible { outline: 3px solid var(--accent); }
  .bar { flex: 1; min-width: 1px; border-radius: 2px; background: color-mix(in srgb, var(--text) 38%, transparent); }
  .wait { margin: auto; color: var(--text-faint); font-size: 0.9rem; }
  .zone { position: absolute; top: 0; bottom: 0; background: var(--accent); pointer-events: none; }
  .z10 { opacity: 0.12; }
  .z5 { opacity: 0.16; }
  .z2 { opacity: 0.24; }
  .mark { position: absolute; top: 0; bottom: 0; width: 3px; margin-left: -1px; background: var(--accent); pointer-events: none; }
  .head-line { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--text); opacity: 0.7; pointer-events: none; }
  .tip { margin: 0; color: var(--text-faint); font-size: 0.82rem; }
  .problem { margin: 0; color: var(--text-dim); }
  .row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--s-2); }
  .hear {
    min-height: 44px; border-radius: var(--r-pill); border: 1.5px solid var(--line-strong); background: var(--surface);
    color: var(--text); font-weight: 700; font-variant-numeric: tabular-nums;
  }
  .hear.on { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
  .hear:disabled { opacity: 0.4; }
  .auto { color: var(--text-dim); }
</style>
