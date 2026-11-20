<script lang="ts">
  import Avatar from '../../components/room/Avatar.svelte';
  import type { Tick } from './view';

  // Who still has to vote (or write): a row of avatars, ticked when they are done. Names stay
  // readable. `away`: their phone is off (the host screen knows; phones are not told).
  let { people, label = 'Votes in', size = 36 }: { people: (Tick & { away?: boolean })[]; label?: string; size?: number } = $props();
</script>

<ul class="voters" aria-label={label}>
  {#each people as p (p.name)}
    <li class:done={p.done}>
      <Avatar name={p.name} color={p.color} {size} dim={!p.done && !!p.away} />
      <span>{p.done ? '✓ ' : ''}{p.name}</span>
    </li>
  {/each}
</ul>

<style>
  .voters { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--s-2); justify-content: center; }
  li { display: flex; align-items: center; gap: 6px; padding: 4px 12px 4px 4px; border-radius: var(--r-pill); background: var(--overlay); color: var(--text-faint); font-weight: 700; font-size: 0.95rem; }
  li.done { color: var(--c-good); background: color-mix(in srgb, var(--c-good) 14%, var(--surface)); }
</style>
