<script lang="ts">
  import Avatar from '../../components/room/Avatar.svelte';
  import { seatStatus } from './labels';
  import type { View } from './view';

  // The room's players with where each stands (judge, played, choosing, away); the lobby adds ✕ to remove.
  let { v, online, onkick, scores = false }: { v: View; online?: ReadonlySet<string>; onkick?: (pid: string) => void; scores?: boolean } = $props();
</script>

<ul class="seats">
  {#each v.players as p, i (p.pid)}
    {@const status = seatStatus(v, p.pid, online)}
    <li class:done={status === 'Played' || status === 'Voted'} class:judge={status === 'Judge'}>
      <Avatar name={p.name} color={i} size={36} dim={online ? !online.has(p.pid) : false} />
      <div class="who"><strong>{p.name}</strong>{#if status}<span>{status === 'Played' || status === 'Voted' ? '✓ ' : ''}{status}</span>{/if}</div>
      {#if scores}<b>{p.score}</b>{/if}
      {#if onkick}<button class="remove" aria-label="Remove {p.name}" title="Remove {p.name}" onclick={() => onkick?.(p.pid)}>✕</button>{/if}
    </li>
  {/each}
</ul>

<style>
  .seats { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--s-2); grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); }
  li { display: flex; align-items: center; gap: var(--s-2); min-height: 52px; padding: var(--s-1) var(--s-3); border: 2px solid var(--line); border-radius: var(--r-md); background: var(--surface); min-width: 0; }
  .who { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
  .who strong { overflow-wrap: anywhere; }
  .who span { color: var(--text-dim); font-size: 0.92rem; }
  li b { font: 800 1.15rem / 1 var(--font-display); }
  .done { border-color: var(--accent); }
  .done span, .judge span { color: var(--accent); font-weight: 700; }
  .remove { flex: none; min-width: 44px; min-height: 44px; border-radius: var(--r-pill); background: transparent; color: var(--text-dim); }
</style>
