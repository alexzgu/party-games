<script lang="ts">
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import ListTools from '../../components/ListTools.svelte';
  import { customDecks, wordDecks, type WordDeck } from '../../lib/content';
  import type { SortKey } from '../../lib/listing';
  import { go } from '../../lib/router.svelte';
  import { findDecks, type DeckHit } from './find';

  // Every deck on this phone, the player's own first: open one to see all its words and edit it.
  const mine = customDecks.all();
  const builtins = wordDecks().filter((d) => customDecks.isBuiltin(d.id));
  const open = (d: WordDeck) => go('/forehead/deck?id=' + encodeURIComponent(d.id));

  // One search and order for both sections; a section with no match hides while searching.
  let query = $state('');
  let sort = $state<SortKey>('suggested');
  const searching = $derived(!!query.trim());
  const myHits = $derived(findDecks(mine, query, sort));
  const builtinHits = $derived(findDecks(builtins, query, sort));
</script>

{#snippet row({ deck: d, via }: DeckHit, i: number)}
  <li class="pop-in" style:animation-delay="{Math.min(i, 12) * 25}ms">
    <button class="row" onclick={() => open(d)}>
      <span class="emoji" aria-hidden="true">{d.emoji || '🃏'}</span>
      <span class="txt">
        <span class="name">{d.name}</span>
        <span class="faint">{d.words.length} words{#if customDecks.isEdited(d.id)} · <b class="edited">Edited</b>{/if}</span>
        {#if via}<span class="via">has “{via}”</span>{/if}
      </span>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  </li>
{/snippet}

<Screen title="Decks" accent="var(--c-forehead)">
  <div class="tools">
    <ListTools key="forehead:decks" bind:query bind:sort placeholder="Search decks or words" shown={myHits.length + builtinHits.length} total={mine.length + builtins.length}>
      {#snippet title()}<p class="faint intro">Open a deck to see every word, add your own or remove some.</p>{/snippet}
    </ListTools>
  </div>
  {#if !searching || myHits.length}
    <section class="stack">
      <h3>Yours</h3>
      {#if myHits.length}
        <ul class="list">{#each myHits as h, i (h.deck.id)}{@render row(h, i)}{/each}</ul>
      {:else}
        <p class="faint">None yet. Paste a list, type the words in yourself, or ask Claude.</p>
      {/if}
    </section>
  {/if}
  {#if !searching || builtinHits.length}
    <section class="stack">
      <h3>Built in</h3>
      <ul class="list">{#each builtinHits as h, i (h.deck.id)}{@render row(h, myHits.length + i)}{/each}</ul>
    </section>
  {/if}
  {#if searching && !myHits.length && !builtinHits.length}
    <p class="faint none">No decks match “{query.trim()}”</p>
  {/if}

  {#snippet actions()}
    <Button size="lg" onclick={() => go('/forehead/make')}>✨ Make a deck</Button>
    <Button variant="secondary" onclick={() => go('/forehead/deck?id=new')}>Type a deck by hand</Button>
  {/snippet}
</Screen>

<style>
  .tools { margin: calc(-1 * var(--s-2)) 0 calc(-1 * var(--s-3)); }
  .intro { font-size: 0.95rem; line-height: 1.3; }
  .none { text-align: center; padding: var(--s-2) 0; }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  .row {
    width: 100%; display: flex; align-items: center; gap: var(--s-3); padding: var(--s-3) var(--s-4); min-height: 68px;
    border: 0; border-radius: var(--r-md); background: var(--surface); text-align: left; color: var(--text-faint);
    transition: transform var(--dur-fast) var(--ease-out);
  }
  .row:active { transform: scale(0.98); }
  .emoji { font-size: 1.8rem; }
  .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .via { color: var(--text-dim); font-size: 0.85rem; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .name { font-family: var(--font-display); font-weight: 800; font-size: 1.2rem; color: var(--text); }
  .edited { color: var(--accent); font-weight: 700; }
</style>
