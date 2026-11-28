<script lang="ts">
  import type { View } from './view';

  // A finished deal: who went out, and each player's cards left, points this deal and total.
  let { v, name, you, size = 'md' }: { v: View; name: (pid: string) => string; you?: string; size?: 'md' | 'lg' } = $props();
  const total = (pid: string) => v.players.find((p) => p.pid === pid)?.points ?? 0;
</script>

{#if v.result}
  <div class="deal {size}">
    <h2>{v.result.out ? `${name(v.result.out)} went out!` : 'Deal over'}</h2>
    <table>
      <thead><tr><th scope="col">Player</th><th scope="col">Cards left</th><th scope="col">Points</th><th scope="col">Total</th></tr></thead>
      <tbody>
        {#each v.result.rows as r (r.pid)}
          <tr class:you={r.pid === you}><th scope="row">{name(r.pid)}</th><td>{r.cards}</td><td>+{r.points}</td><td><b>{total(r.pid)}</b></td></tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}

<style>
  .deal { display: grid; gap: var(--s-2); width: 100%; }
  h2 { color: var(--accent); overflow-wrap: anywhere; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: var(--s-1) var(--s-2); text-align: right; border-bottom: 1px solid var(--line); }
  th[scope='row'], thead th:first-child { text-align: left; overflow-wrap: anywhere; }
  thead th { color: var(--text-dim); font-size: 0.85rem; font-weight: 600; }
  .you th, .you td { color: var(--accent); }
  .lg { width: min(100%, 900px); margin-inline: auto; }
  .lg h2 { text-align: center; font-size: clamp(1.6rem, calc(3.6vw * var(--text-scale)), 3rem); }
  .lg table { font-size: clamp(1rem, calc(1.7vw * var(--text-scale)), 1.4rem); }
</style>
