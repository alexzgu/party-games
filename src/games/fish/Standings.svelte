<script lang="ts">
  import Confetti from '../../components/room/Confetti.svelte';
  import { ordinal } from '../../lib/room/look';
  import Books from './Books.svelte';
  import type { View } from './view';

  // The end: who won (most books; ties share a place) and the standings with each player's books.
  let { v, you, size = 'md' }: { v: View; you?: string; size?: 'md' | 'lg' } = $props();
  const top = $derived(v.players[0]?.books.length ?? 0);
  const winners = $derived(v.players.filter((p) => p.books.length === top && top > 0).map((p) => p.name));
</script>

<Confetti colors={['var(--c-fish)', 'var(--card-red)', 'var(--c-gold)']} />
<div class="end {size}">
  <h2 class="headline">{winners.length ? `${winners.join(' & ')} win${winners.length === 1 ? 's' : ''}!` : 'Game over'}</h2>
  <p class="muted">The most books wins.</p>
  <ol class="table">
    {#each v.players as p (p.pid)}
      <li class:you={p.pid === you}>
        <span>{ordinal(1 + v.players.filter((x) => x.books.length > p.books.length).length)}</span>
        <div><strong>{p.name}</strong><Books books={p.books} /></div>
        <b>{p.books.length}</b>
      </li>
    {/each}
  </ol>
</div>

<style>
  .end { display: grid; gap: var(--s-3); width: 100%; }
  .headline { color: var(--accent); overflow-wrap: anywhere; }
  .lg { width: min(100%, 900px); margin-inline: auto; }
  .lg .headline { font-size: clamp(1.8rem, calc(4.5vw * var(--text-scale)), 3.6rem); text-align: center; }
  .lg > p { text-align: center; font-size: clamp(1rem, calc(1.6vw * var(--text-scale)), 1.3rem); }
  ol { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--s-2); }
  .table li { display: flex; align-items: center; gap: var(--s-3); padding: var(--s-2) var(--s-4); border-radius: var(--r-md); background: var(--surface); }
  .table div { flex: 1; min-width: 0; display: grid; gap: var(--s-1); }
  .table strong { overflow-wrap: anywhere; }
  .table span { color: var(--text-dim); min-width: 2.5em; }
  .table b { font: 800 1.3rem / 1 var(--font-display); }
  .lg .table li { font-size: clamp(1rem, calc(1.8vw * var(--text-scale)), 1.5rem); }
  .you { outline: 2px solid var(--accent); }
</style>
