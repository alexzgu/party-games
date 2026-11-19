<script lang="ts">
  import { flip } from 'svelte/animate';
  import Avatar from './Avatar.svelte';
  import { standings, type GameState } from './logic';

  // Everyone's score, leader first, with one pip per point needed to win.
  let { game, flash = -1, nextReader = -1 }: { game: GameState; flash?: number; nextReader?: number } = $props();
  const rows = $derived(standings(game));
</script>

<ol class="board" aria-label="Scores, first to {game.target}">
  {#each rows as { player, index } (index)}
    <li class:flash={index === flash} animate:flip={{ duration: 380 }}>
      <Avatar name={player.name} {index} size={36} />
      <span class="name">
        {player.name}
        {#if index === nextReader}<span class="next">reads next</span>{/if}
      </span>
      <span class="pips" aria-hidden="true">
        {#each { length: game.target } as _, k (k)}<i class:on={k < player.score}></i>{/each}
      </span>
      <b class="score">{player.score}</b>
      {#if index === flash}<span class="plus" aria-hidden="true">+1</span>{/if}
    </li>
  {/each}
</ol>

<style>
  .board { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  li {
    position: relative; display: flex; align-items: center; gap: var(--s-3);
    padding: var(--s-2) var(--s-3); border-radius: var(--r-md); background: var(--surface); min-height: 52px;
  }
  li.flash { background: color-mix(in srgb, var(--accent) 22%, var(--surface)); box-shadow: inset 0 0 0 2px var(--accent); }
  .name { flex: 1; min-width: 0; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .next { margin-left: var(--s-2); font-size: 0.78rem; font-weight: 600; color: var(--text-faint); }
  .pips { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; max-width: 45%; }
  .pips i { width: 9px; height: 9px; border-radius: 50%; background: var(--surface-hi); }
  .pips i.on { background: var(--c-gold); }
  .score { min-width: 1.6em; text-align: right; font-family: var(--font-display); font-size: 1.5rem; font-variant-numeric: tabular-nums; }
  .plus {
    position: absolute; right: var(--s-3); top: -6px; font-family: var(--font-display); font-weight: 800; color: var(--c-gold);
    animation: float 1.2s var(--ease-out) both;
  }
  @keyframes float { from { opacity: 0; transform: translateY(14px) scale(0.6); } 30% { opacity: 1; transform: translateY(-4px) scale(1.15); } to { opacity: 0; transform: translateY(-22px); } }
  @media (prefers-reduced-motion: reduce) { .plus { animation: none; opacity: 0; } }
</style>
