<script lang="ts">
  import Avatar from '../../components/room/Avatar.svelte';
  import { ordinal } from '../../lib/room/look';
  import type { PlayerView } from './view';

  let { players, final, you = '' }: { players: PlayerView['players']; final: boolean; you?: string } = $props();
  const ranked = $derived(players.filter((p) => !p.kicked).sort((a, b) => b.score - a.score || a.seat - b.seat));
  const format = (n: number) => n.toLocaleString();
</script>

<ol aria-label="Standings">
  {#each ranked as player (player.pid)}
    {@const rank = ranked.findIndex((p) => p.score === player.score) + 1}
    <li class:first={final && rank === 1} class:you={player.pid === you}>
      <span class="rank">{ordinal(rank)}</span>
      <Avatar name={player.name} color={player.seat} size={36} />
      <span class="name"><b>{player.name}</b>{#if player.pid === you}<small>You</small>{/if}</span>
      {#if !final}<span class="gains" aria-label="{format(player.roundPoints)} points this round">+{format(player.roundPoints)}</span>{/if}
      <b class="score">{format(player.score)} pts</b>
    </li>
  {/each}
</ol>

<style>
  ol { display: grid; gap: var(--s-2); list-style: none; margin: 0; padding: 0; }
  li { display: flex; gap: var(--s-2); align-items: center; padding: var(--s-2) var(--s-3); border-radius: var(--r-md); background: var(--surface); border: 2px solid var(--line); font-size: var(--standing-size, 1rem); }
  .first, .you { border-color: var(--accent); }
  .rank, .gains, small { color: var(--text-dim); }
  .rank { min-width: 2.1rem; }
  .name { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  small { display: block; }
  .score, .gains { white-space: nowrap; font-variant-numeric: tabular-nums; }
</style>
