<script lang="ts">
  import Avatar from '../../components/room/Avatar.svelte';
  import type { View } from './view';

  // The lobby's players; the host's lobby adds ✕ to remove.
  let { v, online, onkick }: { v: View; online?: ReadonlySet<string>; onkick?: (pid: string) => void } = $props();
</script>

<ul class="seats">
  {#each v.players as p, i (p.pid)}
    {@const away = online ? !online.has(p.pid) : false}
    <li>
      <Avatar name={p.name} color={i} size={36} dim={away} />
      <div class="who"><strong>{p.name}</strong>{#if away}<span>Away</span>{/if}</div>
      {#if onkick}<button class="remove" aria-label="Remove {p.name}" onclick={() => onkick?.(p.pid)}>✕</button>{/if}
    </li>
  {/each}
</ul>

<style>
  .seats { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--s-2); grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); }
  li { display: flex; align-items: center; gap: var(--s-2); min-height: var(--tap-md); padding: var(--s-1) var(--s-3); border: 2px solid var(--line); border-radius: var(--r-md); background: var(--surface); min-width: 0; }
  .who { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
  .who strong { overflow-wrap: anywhere; }
  .who span { color: var(--text-dim); font-size: 0.92rem; }
  .remove { flex: none; min-width: 44px; min-height: 44px; border-radius: var(--r-pill); background: transparent; color: var(--text-dim); }
</style>
