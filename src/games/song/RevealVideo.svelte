<script lang="ts">
  import { onMount } from 'svelte';
  import { revealPlayer, type Player } from './youtube';

  // The song's music video at the reveal, in full view with YouTube's own controls (never
  // covered, never smaller than 200×200). It waits for the room to start it; starting it stops
  // the preview. If YouTube cannot be reached or will not play it, a plain link takes its place.
  let { id, demo = false, onplay }: { id: string; demo?: boolean; onplay: () => void } = $props();

  let host = $state<HTMLDivElement>();
  let failed = $state(false);

  onMount(() => {
    if (demo) return;
    let player: Player | null = null;
    let gone = false;
    if (!host) return;
    // Never ready in time, or an error before or after ready (a video that can't play here): the link.
    revealPlayer(host, id, onplay, () => (failed = true)).then((p) => { if (gone) p.destroy(); else player = p; }, () => (failed = true));
    return () => {
      gone = true;
      try { player?.destroy(); } catch { /* already gone */ }
    };
  });
</script>

<div class="video">
  {#if failed}
    <a class="fallback" href="https://www.youtube.com/watch?v={id}" target="_blank" rel="noopener noreferrer">Watch the video on YouTube ↗</a>
  {:else if demo}
    <div class="fake" aria-label="Music video"><span>▶</span></div>
  {:else}
    <div bind:this={host} class="host"></div>
  {/if}
</div>

<style>
  .video {
    position: relative; width: 100%; aspect-ratio: 16 / 9; min-height: 204px; min-width: 204px; box-sizing: border-box;
    border-radius: var(--r-lg); overflow: hidden; background: var(--bg-sunk);
    border: 2px solid color-mix(in srgb, var(--accent) 45%, transparent);
  }
  .host, .video :global(iframe) { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  .fallback { position: absolute; inset: 0; display: grid; place-items: center; color: var(--accent); font-weight: 700; }
  .fake {
    position: absolute; inset: 0; display: grid; place-items: center;
    background: radial-gradient(80% 90% at 30% 30%, color-mix(in srgb, var(--accent) 55%, transparent), transparent 70%), linear-gradient(135deg, var(--c-dial), var(--c-forehead));
  }
  .fake span { width: 68px; height: 48px; border-radius: 12px; background: var(--c-bad); color: var(--on-accent); display: grid; place-items: center; font-size: 1.4rem; }
</style>
