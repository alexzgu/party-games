<script lang="ts">
  import Avatar from '../../components/room/Avatar.svelte';
  import { seatStatus } from './labels';
  import type { View } from './view';

  // The room's players with where each stands (answered, thinking, away); while answering, a name
  // is dimmed until that player has answered (never what). The lobby adds ✕ to remove.
  let { v, online, onkick }: { v: View; online?: ReadonlySet<string>; onkick?: (pid: string) => void } = $props();
</script>

<ul class="seats">
  {#each v.players as p, i (p.pid)}
    {@const status = seatStatus(v, p.pid, online)}
    <li class:done={status === 'Answered'} class:waiting={v.phase === 'answer' && status !== 'Answered'}>
      <span class="avatar"><Avatar name={p.name} color={i} size={36} dim={online ? !online.has(p.pid) : false} /></span>
      <div class="who"><strong>{p.name}</strong>{#if status}<span>{status === 'Answered' ? '✓ ' : ''}<span class="word">{status}</span></span>{/if}</div>
      {#if onkick}<button class="remove" aria-label="Remove {p.name}" onclick={() => onkick?.(p.pid)}>✕</button>{/if}
    </li>
  {/each}
</ul>

<style>
  .seats { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--s-2); grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr)); }
  li { display: flex; align-items: center; gap: var(--s-2); min-height: 52px; padding: var(--s-1) var(--s-3); border: 2px solid var(--line); border-radius: var(--r-md); background: var(--surface); min-width: 0; transition: opacity var(--dur) ease; }
  .who { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
  .who strong { overflow-wrap: anywhere; }
  .who span { color: var(--text-dim); font-size: 0.92rem; }
  .done { border-color: var(--accent); }
  .done span { color: var(--accent); font-weight: 700; }
  .waiting { opacity: 0.5; }
  .avatar { display: contents; }
  /* A short host window: one line a seat, no avatar, only ✓ for answered, so a full room fits under the answers. */
  @media (max-height: 620px) {
    .seats { grid-template-columns: repeat(auto-fill, minmax(min(100%, 170px), 1fr)); gap: var(--s-1); }
    li { min-height: 34px; padding: 2px var(--s-2); }
    .avatar { display: none; }
    .who { flex-direction: row-reverse; justify-content: flex-end; gap: var(--s-1); align-items: baseline; font-size: 0.9rem; }
    .word { display: none; }
  }
  .remove { flex: none; min-width: 44px; min-height: 44px; border-radius: var(--r-pill); background: transparent; color: var(--text-dim); }
</style>
