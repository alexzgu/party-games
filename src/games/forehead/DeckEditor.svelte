<script lang="ts">
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import { customDecks, dedupe, slugify, type WordDeck } from '../../lib/content';
  import { back, go } from '../../lib/router.svelte';
  import { sfx } from '../../lib/sound';
  import { prefs, savePrefs } from './state.svelte';

  // Edit one of my decks. Every change saves at once; there is no Save button to forget.
  let { id }: { id: string } = $props();

  const EMOJIS = ['🃏', '✨', '🎉', '🔥', '🍿', '🎤', '🐶', '🍔', '🌴', '🏆', '🎸', '👻', '💼', '🚀'];

  const existing = customDecks.all().find((d) => d.id === id);
  let deck = $state<WordDeck>(existing ?? { id: '', name: '', emoji: '🃏', blurb: '', words: [] });
  let draft = $state('');
  let confirmDelete = $state(false);
  let input: HTMLInputElement | undefined = $state();

  /** A new deck is picked for the next round once, when its first words arrive (never while empty). */
  let picked = (existing?.words.length ?? 0) > 0;

  function persist() {
    if (!deck.name.trim() && deck.words.length === 0) return;
    if (!deck.id) {
      deck.id = 'my-' + slugify(deck.name || 'deck') + '-' + Date.now().toString(36);
      history.replaceState(null, '', '#/forehead/deck?id=' + encodeURIComponent(deck.id));
    }
    customDecks.put({ ...$state.snapshot(deck), name: deck.name.trim() || 'My deck' });
    if (!picked && deck.words.length > 0) {
      picked = true;
      if (!prefs.deckIds.includes(deck.id)) prefs.deckIds = [deck.id, ...prefs.deckIds];
      savePrefs();
    }
  }

  function add(e?: SubmitEvent) {
    e?.preventDefault();
    const items = draft.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (!items.length) return;
    deck.words = dedupe([...items.reverse(), ...deck.words]);
    draft = '';
    sfx.tick();
    persist();
    input?.focus();
  }

  function removeWord(w: string) {
    deck.words = deck.words.filter((x) => x !== w);
    persist();
  }

  function remove() {
    if (!confirmDelete) { confirmDelete = true; return; }
    if (deck.id) {
      customDecks.remove(deck.id);
      prefs.deckIds = prefs.deckIds.filter((x) => x !== deck.id);
      savePrefs();
    }
    back('/forehead/decks');
  }

  function claude() {
    persist();
    go('/forehead/make?into=' + encodeURIComponent(deck.id));
  }
</script>

<Screen title={existing ? 'Edit deck' : 'New deck'} accent="var(--c-forehead)">
  <section class="stack">
    <label class="field">
      <span class="lbl">Name</span>
      <input type="text" placeholder="e.g. Our Friend Group" bind:value={deck.name} oninput={persist} maxlength="40" />
    </label>
    <div class="emojis" role="radiogroup" aria-label="Deck icon">
      {#each EMOJIS as e (e)}
        <button role="radio" aria-checked={deck.emoji === e} class:on={deck.emoji === e} onclick={() => { deck.emoji = e; persist(); }}>{e}</button>
      {/each}
    </div>
  </section>

  <section class="stack">
    <h3>Words <span class="faint n">{deck.words.length}</span></h3>
    <form class="add" onsubmit={add}>
      <input type="text" placeholder="Type a word, press Enter" bind:value={draft} bind:this={input} enterkeyhint="done" autocapitalize="words" aria-label="New word" />
      <Button type="submit" size="sm" disabled={!draft.trim()}>Add</Button>
    </form>
    {#if deck.words.length}
      <ul class="chips">
        {#each deck.words as w (w)}
          <li class="chip pop-in">
            <span>{w}</span>
            <button aria-label="Remove {w}" onclick={() => removeWord(w)}>
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="faint">No words yet. Add them one by one, paste a comma-separated list, or let Claude fill it.</p>
    {/if}
  </section>

  {#if deck.id}
    <Button variant={confirmDelete ? 'danger' : 'ghost'} onclick={remove}>{confirmDelete ? 'Tap again to delete this deck' : 'Delete deck'}</Button>
  {/if}

  {#snippet actions()}
    <Button size="lg" variant="secondary" onclick={claude} disabled={!deck.name.trim() && !deck.words.length}>✨ Add words with Claude</Button>
  {/snippet}
</Screen>

<style>
  .field { display: flex; flex-direction: column; gap: var(--s-1); }
  .lbl { font-weight: 600; color: var(--text-dim); font-size: 0.92rem; }
  .emojis { display: grid; grid-template-columns: repeat(auto-fill, minmax(44px, 1fr)); gap: 6px; }
  .emojis button { aspect-ratio: 1; min-height: 44px; border-radius: var(--r-sm); border: 2px solid transparent; background: var(--surface); font-size: 1.4rem; }
  .emojis .on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 22%, var(--surface)); }
  .n { font-family: var(--font-body); font-weight: 500; font-size: 0.95rem; }
  .add { display: flex; gap: var(--s-2); align-items: center; }
  .add input { flex: 1; }
  .chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { display: flex; align-items: center; gap: 2px; padding-left: var(--s-3); border-radius: var(--r-pill); background: var(--surface); min-height: 44px; }
  .chip button { width: 40px; height: 40px; border: 0; background: transparent; color: var(--text-faint); display: grid; place-items: center; border-radius: 50%; }
</style>
