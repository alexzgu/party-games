<script lang="ts">
  import Avatar from './Avatar.svelte';
  import { standings, type GameState } from './logic';

  // The standings, best first; `gained` adds this round's points beside each score, `top` rings the leaders.
  let { game, gained = [], top = [] }: { game: GameState; gained?: number[]; top?: number[] } = $props();
  const rows = $derived(standings(game));
</script>

<ol class="board" aria-label="Scores">
  {#each rows as { player, index } (index)}
    <li class:top={top.includes(index)}>
      <Avatar name={player.name} {index} size={32} />
      <span class="pname">{player.name}</span>
      {#if gained[index]}<span class="plus">+{gained[index]}</span>{/if}
      <b class="score">{player.score}</b>
    </li>
  {/each}
</ol>

<style>
  .board { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  li { display: flex; align-items: center; gap: var(--s-3); padding: var(--s-2) var(--s-3); border-radius: var(--r-md); background: var(--surface); min-height: 48px; }
  li.top { box-shadow: inset 0 0 0 2px var(--c-gold); }
  .pname { flex: 1; min-width: 0; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .plus { color: var(--c-good); font-weight: 800; font-variant-numeric: tabular-nums; }
  .score { font-family: var(--font-display); font-size: 1.5rem; font-variant-numeric: tabular-nums; min-width: 1.5em; text-align: right; }
</style>
