<script lang="ts">
  import Avatar from './Avatar.svelte';
  import type { GameState } from './logic';

  // Everyone's score in seating order (the order turns go in): who is up is outlined, the
  // player who just scored glows with a +1.
  let { game, flash = -1, up = -1 }: { game: GameState; flash?: number; up?: number } = $props();
</script>

<ol class="strip" aria-label="Scores, first to {game.target}">
  {#each game.players as p, i (i)}
    <li class:flash={i === flash} class:up={i === up} aria-current={i === up ? 'true' : undefined}>
      <Avatar name={p.name} index={i} size={26} />
      <span class="name">{p.name}</span>
      <b class="score">{p.score}</b>
      {#if i === flash}<span class="plus" aria-hidden="true">+1</span>{/if}
    </li>
  {/each}
</ol>

<style>
  .strip { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--s-2); justify-content: center; }
  li {
    position: relative; display: flex; align-items: center; gap: 6px; min-height: 44px; max-width: 100%;
    padding: 4px var(--s-3) 4px 6px; border-radius: var(--r-pill); background: var(--surface); border: 2px solid transparent;
  }
  li.up { border-color: var(--line-strong); }
  li.flash { background: color-mix(in srgb, var(--accent) 22%, var(--surface)); border-color: var(--accent); }
  .name { font-weight: 700; min-width: 0; max-width: 9em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .score { font-family: var(--font-display); font-size: 1.25rem; font-variant-numeric: tabular-nums; }
  .plus {
    position: absolute; right: -4px; top: -14px; font-family: var(--font-display); font-weight: 800; color: var(--c-gold);
    animation: float 1.2s var(--ease-out) both;
  }
  @keyframes float { from { opacity: 0; transform: translateY(14px) scale(0.6); } 30% { opacity: 1; transform: translateY(-4px) scale(1.15); } to { opacity: 0; transform: translateY(-18px); } }
  @media (prefers-reduced-motion: reduce) { .plus { animation: none; opacity: 0; } }
  /* A phone on its side: the scores share a column with the last turn, so the chips come down a size. */
  @media (orientation: landscape) and (max-height: 500px) {
    .strip { gap: 6px; }
    li { min-height: 38px; padding: 2px var(--s-2) 2px 4px; gap: 4px; font-size: 0.92rem; }
    .name { max-width: 7em; }
    .score { font-size: 1.1rem; }
  }
</style>
