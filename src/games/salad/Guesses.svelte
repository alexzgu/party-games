<script lang="ts">
  import type { PlayerView } from './view';

  let { guesses, players }: { guesses: PlayerView['guesses']; players: PlayerView['players'] } = $props();
  const newest = $derived([...guesses].reverse());
</script>

<section aria-label="Room guesses">
  <h3>Guesses</h3>
  {#if newest.length}
    <ul>
      {#each newest as guess (guess.id)}
        <li><b>{guess.text}</b><span>{players.find((p) => p.pid === guess.pid)?.name ?? 'Player'}</span></li>
      {/each}
    </ul>
  {:else}
    <p class="muted">Waiting for the first guess…</p>
  {/if}
</section>

<style>
  section {
    display: flex; flex-direction: column; gap: var(--s-2); min-height: 0;
    background: var(--bg-sunk); padding: var(--s-3) var(--s-4); border-radius: var(--r-lg); font-size: var(--guess-size, 1rem);
  }
  h3 { color: var(--text-dim); }
  ul { padding: 0; margin: 0; overflow: auto; list-style: none; max-height: var(--guesses-height, 34dvh); }
  li { display: flex; gap: var(--s-3); justify-content: space-between; align-items: baseline; padding: var(--s-2) 0; overflow-wrap: anywhere; }
  li + li { border-top: 1px solid var(--line); }
  li span { color: var(--text-dim); flex: 0 1 auto; text-align: right; }
</style>
