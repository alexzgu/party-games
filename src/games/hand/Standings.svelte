<script lang="ts">
  import Confetti from '../../components/room/Confetti.svelte';
  import { ordinal } from '../../lib/room/look';
  import { filled } from './cards';
  import { HOUSE } from './logic';
  import type { View } from './view';

  // The end: who won (or the house, and everyone lost), the standings, and every round's winning answer.
  let { v, name, you, size = 'md' }: { v: View; name: (pid: string) => string; you?: string; size?: 'md' | 'lg' } = $props();
  const top = $derived(v.players[0]?.score ?? 0);
  const houseWon = $derived(v.house !== null && v.house >= v.target);
  const winners = $derived(v.players.filter((p) => p.score === top && top > 0).map((p) => p.name));
</script>

<Confetti colors={['var(--accent)', 'var(--c-good)', 'var(--c-gold)']} />
<div class="end {size}">
  <h2 class="headline">{houseWon ? 'The house wins. Everyone loses.' : winners.length ? `${winners.join(' & ')} win${winners.length === 1 ? 's' : ''}!` : 'Game over'}</h2>
  <ol class="table">
    {#if v.house !== null}<li class="house"><span>House</span><strong>The house</strong><b>{v.house}</b></li>{/if}
    {#each v.players as p (p.pid)}
      <li class:you={p.pid === you}><span>{ordinal(1 + v.players.filter((x) => x.score > p.score).length)}</span><strong>{p.name}</strong><b>{p.score}</b></li>
    {/each}
  </ol>
  {#if v.results?.length}
    <h3>Winning answers</h3>
    <ol class="wins">
      {#each v.results as w, i (i)}
        <li><span>{filled(w.prompt, w.texts)}</span><small>{w.by === HOUSE ? 'The house' : name(w.by)}</small></li>
      {/each}
    </ol>
  {/if}
</div>

<style>
  .end { display: grid; gap: var(--s-3); width: 100%; }
  .headline { color: var(--accent); overflow-wrap: anywhere; }
  .lg .headline { font-size: clamp(1.8rem, calc(4.5vw * var(--text-scale)), 3.6rem); text-align: center; }
  ol { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--s-2); }
  .table li { display: flex; align-items: center; gap: var(--s-3); padding: var(--s-2) var(--s-4); border-radius: var(--r-md); background: var(--surface); }
  .table strong { flex: 1; overflow-wrap: anywhere; }
  .table span { color: var(--text-dim); min-width: 2.5em; }
  .table b { font: 800 1.3rem / 1 var(--font-display); }
  .lg .table li { font-size: clamp(1rem, calc(1.8vw * var(--text-scale)), 1.5rem); }
  .you { outline: 2px solid var(--accent); }
  .house { border: 2px dashed var(--line-strong); }
  .wins li { display: grid; gap: 2px; padding: var(--s-2) var(--s-3); border-left: 4px solid var(--accent); background: var(--bg-sunk); border-radius: var(--r-sm); }
  .wins span { font-weight: 600; overflow-wrap: anywhere; }
  .wins small { color: var(--text-dim); }
  .lg .wins { grid-template-columns: repeat(auto-fill, minmax(min(100%, 360px), 1fr)); }
</style>
