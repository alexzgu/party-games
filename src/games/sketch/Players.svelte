<script lang="ts">
  import Avatar from '../../components/room/Avatar.svelte';
  import type { Player } from './core';
  // The room's players with a word on each (Done, Away, Watching); the lobby can remove one.
  let { players, online, status, onkick }: {
    players: Player[]; online?: ReadonlySet<string>;
    status?: (pid: string) => string;
    /** Host lobby: remove a player (asks first). */
    onkick?: (pid: string) => void;
  } = $props();
  const away = (pid: string) => !!online && !online.has(pid);
</script>

<ul>
  {#each players as p, i (p.pid)}
    <li>
      <Avatar name={p.name} color={i} size={36} dim={away(p.pid)} />
      <strong>{p.name}</strong>
      {#if status?.(p.pid)}<span>{status(p.pid)}</span>{:else if away(p.pid)}<span>Away</span>{/if}
      {#if onkick}<button class="remove" aria-label="Remove {p.name}" title="Remove {p.name}" onclick={() => onkick?.(p.pid)}>✕</button>{/if}
    </li>
  {/each}
</ul>

<style>
  ul { list-style: none; padding: 0; display: grid; gap: var(--s-2); }
  li { display: flex; align-items: center; gap: var(--s-2); background: var(--surface); padding: var(--s-2) var(--s-3); border-radius: var(--r-md); min-width: 0; }
  strong { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  span { color: var(--text-dim); }
  .remove { flex: none; min-width: 44px; min-height: 44px; border-radius: var(--r-pill); background: transparent; color: var(--text-dim); }
  @media (min-width: 800px) { ul { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
