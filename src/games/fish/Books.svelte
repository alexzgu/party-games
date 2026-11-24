<script lang="ts">
  import { rankLabel, rankPlural, type Rank } from '../../lib/cards/deck';

  // A player's books as rank badges ("7", "K"), named in full for screen readers.
  let { books, size = 'md' }: { books: readonly Rank[]; size?: 'md' | 'lg' } = $props();
</script>

{#if books.length}
  <ul class="books {size}" aria-label="Books: {books.map(rankPlural).join(', ')}">
    {#each books as r (r)}<li aria-hidden="true">{rankLabel(r)}</li>{/each}
  </ul>
{:else}<span class="none">No books yet</span>{/if}

<style>
  .books { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--s-1); }
  li { min-width: 1.9em; padding: 0.15em 0.35em; text-align: center; border-radius: var(--r-sm); background: var(--accent); color: var(--on-accent); font: 800 0.95rem / 1.2 var(--font-display); }
  .lg li { font-size: clamp(0.95rem, 1.3vw, 1.2rem); }
  .none { color: var(--text-faint); font-size: 0.9rem; }
</style>
