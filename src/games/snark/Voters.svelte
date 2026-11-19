<script lang="ts">
  import Avatar from './Avatar.svelte';
  import type { Player } from './logic';

  // Who still has to vote: a row of avatars, ticked when their vote is in. Names stay readable.
  let { voters, voted, online }: { voters: Player[]; voted: (pid: string) => boolean; online: ReadonlySet<string> } = $props();
</script>

<ul class="voters" aria-label="Votes in">
  {#each voters as p (p.pid)}
    {@const done = voted(p.pid)}
    <li class:done title={p.name}>
      <Avatar name={p.name} color={p.color} size={36} dim={!done && !online.has(p.pid)} />
      <span>{done ? '✓ ' : ''}{p.name}</span>
    </li>
  {/each}
</ul>

<style>
  .voters { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--s-2); justify-content: center; }
  li { display: flex; align-items: center; gap: 6px; padding: 4px 12px 4px 4px; border-radius: var(--r-pill); background: var(--overlay); color: var(--text-faint); font-weight: 700; font-size: 0.95rem; }
  li.done { color: var(--c-good); background: color-mix(in srgb, var(--c-good) 14%, var(--surface)); }
</style>
