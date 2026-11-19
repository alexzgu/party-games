<script lang="ts">
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import { customDecks } from '../../lib/content';
  import { go } from '../../lib/router.svelte';

  // The decks made on this phone: open one to edit, or make a new one.
  const decks = customDecks.all();
</script>

<Screen title="My decks" accent="var(--c-forehead)">
  {#if decks.length}
    <ul class="list">
      {#each decks as d, i (d.id)}
        <li class="pop-in" style:animation-delay="{i * 30}ms">
          <button class="row" onclick={() => go('/forehead/deck?id=' + encodeURIComponent(d.id))}>
            <span class="emoji" aria-hidden="true">{d.emoji || '🃏'}</span>
            <span class="txt"><span class="name">{d.name}</span><span class="faint">{d.words.length} words</span></span>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </li>
      {/each}
    </ul>
  {:else}
    <div class="empty pop-in">
      <span class="big" aria-hidden="true">🃏</span>
      <h3>No decks of your own yet</h3>
      <p class="muted">Make one from any theme with Claude in seconds, or type the words in yourself. Your decks show up first on the setup screen.</p>
    </div>
  {/if}

  {#snippet actions()}
    <Button size="lg" onclick={() => go('/forehead/make')}>✨ Make with Claude</Button>
    <Button variant="secondary" onclick={() => go('/forehead/deck?id=new')}>Type a deck by hand</Button>
  {/snippet}
</Screen>

<style>
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  .row {
    width: 100%; display: flex; align-items: center; gap: var(--s-3); padding: var(--s-3) var(--s-4); min-height: 68px;
    border: 0; border-radius: var(--r-md); background: var(--surface); text-align: left; color: var(--text-faint);
    transition: transform var(--dur-fast) var(--ease-out);
  }
  .row:active { transform: scale(0.98); }
  .emoji { font-size: 1.8rem; }
  .txt { flex: 1; display: flex; flex-direction: column; }
  .name { font-family: var(--font-display); font-weight: 800; font-size: 1.2rem; color: var(--text); }
  .empty { text-align: center; display: flex; flex-direction: column; align-items: center; gap: var(--s-3); padding: var(--s-7) var(--s-4); }
  .big { font-size: 3.5rem; }
  .empty p { max-width: 32ch; }
</style>
