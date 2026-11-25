<script lang="ts">
  import Confetti from '../../components/room/Confetti.svelte';
  import { ordinal } from '../../lib/room/look';
  import type { View } from './view';
  // Draw & guess scores between rounds, and the final standings with confetti; ties share a place.
  let { v }: { v: View } = $props();
  const top = $derived(v.players.filter((p) => p.score === v.players[0]?.score));
</script>

{#if v.phase === 'over'}
  <Confetti colors={['var(--accent)', 'var(--c-good)', 'var(--c-pass)']} />
  <h3 class="winner">{top.map((p) => p.name).join(' & ')} win{top.length === 1 ? 's' : ''}</h3>
{/if}
<ol>
  {#each v.players as p (p.pid)}
    <li><span>{ordinal(1 + v.players.filter((x) => x.score > p.score).length)}</span><strong>{p.name}</strong><b>{p.score.toLocaleString()}</b></li>
  {/each}
</ol>

<style>
  ol { list-style: none; padding: 0; display: grid; gap: var(--s-2); width: min(100%, 640px); margin-inline: auto; }
  li { display: flex; align-items: center; gap: var(--s-3); background: var(--surface); padding: var(--s-2) var(--s-3); border-radius: var(--r-md); }
  li span { color: var(--text-dim); min-width: 2.5em; }
  strong { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .winner { color: var(--accent); text-align: center; font-size: clamp(calc(1.4 * var(--rem-far)), 5vmin, calc(2.6 * var(--rem-far))); overflow-wrap: anywhere; }
</style>
