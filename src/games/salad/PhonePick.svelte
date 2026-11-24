<script lang="ts">
  import { untrack } from 'svelte';
  import { sfx } from '../../lib/sound';
  import type { ToHost } from './protocol';
  import type { PlayerView } from './view';

  // Picking a secret takes two taps: the first selects a tile (raised, the others dimmed) and
  // grows a "Pick" bar on it; the bar sends the pick. Tapping another tile moves the
  // selection. Each selection is sent to the host too, so the deadline takes it, not the first offer.
  let { offers, selected, reshuffled, serial, send }: {
    offers: PlayerView['offers'];
    selected: number | null;
    reshuffled: boolean;
    serial: number;
    send: (m: ToHost) => void;
  } = $props();

  let chosen = $state(untrack(() => selected));

  function choose(index: number) {
    if (index === chosen) return;
    chosen = index;
    sfx.tap();
    send({ serial, t: 'select', index, reshuffled });
  }
</script>

<div class="offers" class:choosing={chosen !== null}>
  {#each offers as offer, index (offer.answer)}
    {@const on = index === chosen}
    <div class="tile" class:on>
      <button class="face" aria-pressed={on} onclick={() => choose(index)}>
        <b>{offer.answer}</b><span>{offer.category}{offer.level === 'easy' ? ' · Easy · Half points' : ''}</span>
      </button>
      {#if on}
        <button class="confirm" aria-label="Pick: {offer.answer}" onclick={() => send({ serial, t: 'pick', index, reshuffled })}>
          Pick
        </button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .offers { display: grid; gap: var(--s-2); }
  .tile {
    display: grid; overflow: hidden; border: 2px solid var(--line); border-radius: var(--r-lg); background: var(--surface);
    transition: transform var(--dur) var(--ease-out), opacity var(--dur) ease, border-color var(--dur) ease, box-shadow var(--dur) ease;
  }
  .choosing .tile:not(.on) { opacity: 0.5; }
  .tile.on { border-color: var(--accent); transform: translateY(-2px); box-shadow: var(--shadow); }
  .face {
    display: grid; gap: var(--s-1); min-height: var(--tap); padding: var(--s-3) var(--s-4);
    text-align: left; background: none; overflow-wrap: anywhere;
  }
  .face b { font: 800 1.35rem / 1.15 var(--font-display); }
  .face span { color: var(--text-dim); text-transform: capitalize; }
  .confirm {
    min-height: var(--tap); padding: 0 var(--s-4); background: var(--accent); color: var(--on-accent);
    font: 800 1.1rem / 1 var(--font-display); animation: grow var(--dur) var(--ease-out);
  }
  .confirm:focus-visible { outline-offset: -5px; outline-color: var(--on-accent); }
  @keyframes grow { from { opacity: 0; transform: translateY(-10px); } }
  @media (prefers-reduced-motion: reduce) {
    .tile.on { transform: none; }
    .confirm { animation: none; }
  }
  /* A phone on its side: the three tiles side by side, so the bar stays on screen. */
  @media (orientation: landscape) and (max-height: 500px) {
    .offers { grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: start; }
  }
</style>
