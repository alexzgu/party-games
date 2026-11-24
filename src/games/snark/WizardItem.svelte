<script lang="ts">
  import type { SnarkItem, Stock } from './pack';

  // One of the wizard's items in review: a prompt with its stock answer, or a final for
  // three-line duels with the house's lines.
  let { i }: { i: SnarkItem | Stock } = $props();
</script>

<span class="it">
  {#if 'kind' in i && i.kind === 'final'}
    <span class="tag">Final</span>
    <span class="q">{i.prompt}</span>
    <span class="sub">House: {i.house.join(' · ')}</span>
  {:else if 'safety' in i}
    <span class="q">{i.prompt}</span>
    <span class="sub">Suggest: {i.safety}</span>
  {/if}
</span>

<style>
  .it { display: flex; flex-direction: column; gap: 2px; text-align: left; }
  .q { font-weight: 700; }
  .sub { font-size: 0.85rem; color: var(--text-faint); }
  .tag { align-self: flex-start; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; padding: 1px 6px; border-radius: var(--r-pill); background: var(--surface-hi); color: var(--text-dim); }
</style>
