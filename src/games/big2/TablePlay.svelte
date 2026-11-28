<script lang="ts">
  import PlayingCard from '../../components/cards/PlayingCard.svelte';
  import { cardName } from '../../lib/cards/deck';
  import { playName } from './labels';
  import type { View } from './view';

  // The play to beat, face up, with who made it; or, with the table clear, who leads. Large on the
  // table, the words under the cards; on a phone the words beside them and five cards overlapping,
  // to keep the hand in view.
  let { v, name, size = 'md' }: { v: View; name: (pid: string) => string; size?: 'md' | 'lg' } = $props();
  const what = $derived(v.table ? playName(v.table.kind, v.table.cards) : '');
</script>

<div class="play {size}">
  {#if v.table}
    <ul class="cards" class:tight={size === 'md' && v.table.cards.length > 2} aria-label="On the table: {what}">
      {#each v.table.cards as c (c)}<li><PlayingCard card={c} {size} /></li>{/each}
    </ul>
    <p><b>{name(v.table.by)}</b> played {what}</p>
  {:else if v.turn}
    <p class="clear">{name(v.turn)} leads{v.first !== undefined ? ` with the ${cardName(v.first)}` : ': anything goes'}</p>
  {/if}
</div>

<style>
  .play { display: grid; justify-items: center; gap: var(--s-1); min-width: 0; text-align: center; }
  .md { grid-template-columns: auto minmax(0, 1fr); align-items: center; justify-items: start; gap: var(--s-3); text-align: left; }
  .md .clear { grid-column: 1 / -1; justify-self: center; }
  .cards { list-style: none; margin: 0; padding: 0; display: flex; gap: var(--s-1); }
  .tight { gap: 0; }
  .tight li + li { margin-left: calc(var(--card-w-md) * -0.45); }
  p { color: var(--text-dim); overflow-wrap: anywhere; line-height: 1.25; }
  p b { color: var(--text); }
  .clear { font-weight: 700; }
  .lg p { font-size: clamp(1rem, calc(1.6vw * var(--text-scale)), 1.4rem); }
  .md p { font-size: 0.9rem; }
</style>
