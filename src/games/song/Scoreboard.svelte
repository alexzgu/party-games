<script lang="ts">
  import { flip } from 'svelte/animate';
  import Avatar from './Avatar.svelte';
  import { standings, type GameState } from './logic';

  // Everyone's score, leader first, with a bar toward the points needed to win.
  let { game, flash = -1, gained = 0 }: { game: GameState; flash?: number; gained?: number } = $props();
  const rows = $derived(standings(game));
</script>

<ol class="board" aria-label="Scores, first to {game.target}">
  {#each rows as { player, index } (index)}
    <li class:flash={index === flash} animate:flip={{ duration: 380 }}>
      <Avatar name={player.name} {index} size={36} />
      <span class="mid">
        <span class="name">{player.name}</span>
        <span class="bar" aria-hidden="true"><i style:width="{Math.min(100, (player.score / game.target) * 100)}%"></i></span>
      </span>
      <b class="score">{player.score}</b>
      {#if index === flash && gained > 0}<span class="plus" aria-hidden="true">+{gained}</span>{/if}
    </li>
  {/each}
</ol>

<style>
  .board { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  li {
    position: relative; display: flex; align-items: center; gap: var(--s-3);
    padding: var(--s-2) var(--s-3); border-radius: var(--r-md); background: var(--surface); min-height: 56px;
  }
  li.flash { background: color-mix(in srgb, var(--accent) 22%, var(--surface)); box-shadow: inset 0 0 0 2px var(--accent); }
  .mid { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
  .name { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .bar { height: 7px; border-radius: var(--r-pill); background: var(--surface-hi); overflow: hidden; }
  .bar i { display: block; height: 100%; border-radius: inherit; background: var(--c-gold); transition: width var(--dur-slow) var(--ease-out); }
  .score { min-width: 1.6em; text-align: right; font-family: var(--font-display); font-size: 1.5rem; font-variant-numeric: tabular-nums; }
  .plus {
    position: absolute; right: var(--s-3); top: -6px; font-family: var(--font-display); font-weight: 800; color: var(--c-gold);
    animation: float 1.2s var(--ease-out) both;
  }
  @keyframes float { from { opacity: 0; transform: translateY(14px) scale(0.6); } 30% { opacity: 1; transform: translateY(-4px) scale(1.15); } to { opacity: 0; transform: translateY(-22px); } }
  @media (prefers-reduced-motion: reduce) { .plus { animation: none; opacity: 0; } }
</style>
