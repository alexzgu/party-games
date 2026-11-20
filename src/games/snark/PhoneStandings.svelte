<script lang="ts">
  import Avatar from './Avatar.svelte';
  import { pts } from './record';
  import { playerColor } from './look';
  import type { Row } from './view';

  // Everyone's total on a phone, this player's row marked; `gains` adds what the round brought.
  let { rows, me, gains = false }: { rows: Row[]; me: string; gains?: boolean } = $props();
</script>

<ol class="rows" aria-label="Scores">
  {#each rows as r, k (r.name)}
    <li class="pop-in" class:me={r.name === me} style:--who={playerColor(r.color)} style:animation-delay="{k * 70}ms">
      <span class="place">{r.place}</span>
      <Avatar name={r.name} color={r.color} size={30} />
      <span class="name">{r.name}</span>
      {#if gains && r.gain}<span class="gain">+{pts(r.gain)}</span>{/if}
      <b>{pts(r.score)}</b>
    </li>
  {/each}
</ol>

<style>
  .rows { list-style: none; margin: 0; padding: 0; width: 100%; display: flex; flex-direction: column; gap: 6px; }
  li { display: flex; align-items: center; gap: var(--s-2); padding: 6px var(--s-3); border-radius: var(--r-md); background: var(--surface); border: 2px solid transparent; font-weight: 700; }
  li.me { border-color: var(--who); background: color-mix(in srgb, var(--who) 14%, var(--surface)); }
  .place { width: 1.3em; color: var(--text-faint); font-family: var(--font-display); font-weight: 800; text-align: center; }
  .name { flex: 1; min-width: 0; color: var(--who); font-weight: 800; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .gain { color: var(--c-good); font-weight: 800; font-size: 0.85rem; white-space: nowrap; }
  b { min-width: 3.6em; text-align: right; font-family: var(--font-display); font-variant-numeric: tabular-nums; }
</style>
