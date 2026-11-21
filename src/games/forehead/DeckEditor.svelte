<script lang="ts">
  import { untrack } from 'svelte';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import ListTools from '../../components/ListTools.svelte';
  import ExportPack from '../../components/ExportPack.svelte';
  import AddMore from '../../components/AddMore.svelte';
  import { mergeOnTop } from '../../lib/addMore';
  import { afterRun, shareWizardPack } from '../../lib/library';
  import type { SortKey } from '../../lib/listing';
  import { customDecks, dedupe, slugify, wordDecks, type WordDeck } from '../../lib/content';
  import { back, go } from '../../lib/router.svelte';
  import { sfx } from '../../lib/sound';
  import { prefs, savePrefs } from './state.svelte';
  import { findWords } from './find';
  import { MORE_RANGE, moreWords } from './generate';
  import { itemKey } from './words';
  import { DEFAULT_ICON, nextIcon } from '../../lib/icon';

  // See and edit any deck. Every change saves at once; there is no Save button to forget.
  // Changing a built-in deck saves an edit of it on this phone, which "Restore original" undoes.
  let { id }: { id: string } = $props();

  const openId = untrack(() => id); // the page is re-created for another id
  const existing = wordDecks().find((d) => d.id === openId);
  const builtin = customDecks.isBuiltin(openId);
  let deck = $state<WordDeck>(existing ?? { id: '', name: '', emoji: DEFAULT_ICON, blurb: '', words: [] });
  let edited = $state(customDecks.isEdited(openId));
  /**
   * The pack's icon: one character (an emoji, a flag or a letter). What is typed or pasted is cut
   * to its first character, and replaces the icon already there (`nextIcon`); an empty box means
   * the default icon. Focusing the box selects what is there too.
   */
  function iconTyped(e: Event & { currentTarget: HTMLInputElement }) {
    const one = nextIcon(deck.emoji, e.currentTarget.value);
    e.currentTarget.value = one;
    deck.emoji = one || DEFAULT_ICON;
    persist();
  }
  let draft = $state('');
  let confirmDelete = $state(false);
  let confirmRestore = $state(false);
  let input: HTMLInputElement | undefined = $state();
  let query = $state('');
  let sort = $state<SortKey>('suggested');
  const words = $derived(findWords(deck.words, query, sort));

  /** A new deck is saved, and picked alone for the next round, when its first words arrive (never while empty). */
  let picked = (existing?.words.length ?? 0) > 0;

  function persist() {
    if (!deck.id && deck.words.length === 0) return;
    if (!deck.id) {
      deck.id = 'my-' + slugify(deck.name || 'deck') + '-' + Date.now().toString(36);
      history.replaceState(history.state, '', '#/forehead/deck?id=' + encodeURIComponent(deck.id)); // keeps the router's step count
    }
    customDecks.put({ ...$state.snapshot(deck), name: deck.name.trim() || 'My pack' });
    edited = builtin;
    confirmRestore = false;
    if (!picked && deck.words.length > 0) {
      picked = true;
      prefs.deckIds = [deck.id];
      savePrefs();
    }
  }

  function add(e?: SubmitEvent) {
    e?.preventDefault();
    const items = draft.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (!items.length) return;
    deck.words = dedupe([...items.reverse(), ...deck.words]);
    draft = '';
    query = ''; // a search must not hide the word just added
    sfx.tick();
    persist();
    input?.focus();
  }

  /** The word last removed and where it was, for Undo. */
  let removed = $state<{ word: string; at: number } | null>(null);
  function removeWord(w: string) {
    removed = { word: w, at: deck.words.indexOf(w) };
    deck.words = deck.words.filter((x) => x !== w);
    persist();
  }
  function undoRemove() {
    if (!removed) return;
    const { word, at } = removed;
    if (!deck.words.includes(word)) deck.words = [...deck.words.slice(0, at), word, ...deck.words.slice(at)];
    removed = null;
    persist();
  }

  function remove() {
    if (!confirmDelete) { confirmDelete = true; return; }
    if (deck.id) {
      customDecks.remove(deck.id);
      prefs.deckIds = prefs.deckIds.filter((x) => x !== deck.id);
      savePrefs();
    }
    back('/forehead');
  }

  function restore() {
    if (!confirmRestore) { confirmRestore = true; return; }
    customDecks.restore(deck.id);
    const original = customDecks.original(deck.id);
    if (original) deck = structuredClone(original);
    edited = false;
    confirmRestore = false;
    sfx.tick();
  }

  /** "🧙 Add more" is open in place of the editor. */
  let adding = $state(false);
  function addMore(kept: string[], byPass: boolean) {
    deck = afterRun({ ...$state.snapshot(deck), words: mergeOnTop(deck.words, kept, itemKey) }, byPass, false);
    query = '';
    adding = false;
    sfx.correct();
    persist();
    void shareWizardPack('forehead', $state.snapshot(deck), byPass);
  }

  function claude() {
    // A built-in only becomes an edit once words are actually added (MakeDeck saves it).
    if (!builtin) persist();
    go(deck.id ? '/forehead/make?into=' + encodeURIComponent(deck.id) : '/forehead/make');
  }
</script>

{#if adding}
  <AddMore name={deck.name} noun="words" range={MORE_RANGE} accent="var(--c-forehead)" steerHint="e.g. more 90s ones, harder"
    ask={(o) => moreWords($state.snapshot(deck), o)} keyOf={(s: string) => s} onadd={addMore} onclose={() => (adding = false)}>
    {#snippet item(s: string)}<span class="word">{s}</span>{/snippet}
  </AddMore>
{:else}
<Screen title={existing ? (builtin ? 'Built-in pack' : 'Edit pack') : 'New pack'} accent="var(--c-forehead)">
  {#if !builtin && deck.shared}<p class="muted">Shared in the Community library: edits you make here are shared too the next time Fizzwick adds to it.</p>{/if}
  {#if builtin}
    <div class="note" class:edited>
      {#if edited}
        <p><b>Edited</b> on this phone. Your changes replace the original everywhere.</p>
        <Button size="sm" variant={confirmRestore ? 'danger' : 'secondary'} onclick={restore}>
          {confirmRestore ? 'Tap again to undo all changes' : 'Restore original'}
        </Button>
      {:else}
        <p>Comes with the game. Any change you make saves as your own version; you can restore the original later.</p>
      {/if}
    </div>
  {/if}

  <section class="stack">
    <label class="field">
      <span class="lbl">Name</span>
      <input type="text" placeholder="e.g. Our Friend Group" bind:value={deck.name} oninput={persist} maxlength="40" />
    </label>
    <label class="field">
      <span class="lbl">Icon</span>
      <span class="icon">
        <span class="preview" aria-hidden="true">{deck.emoji || DEFAULT_ICON}</span>
        <input type="text" inputmode="text" value={deck.emoji} oninput={iconTyped} onfocus={(e) => e.currentTarget.select()}
          placeholder={DEFAULT_ICON} autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-label="Pack icon" />
      </span>
      <span class="faint hint">Type or paste one emoji or letter</span>
    </label>
  </section>

  <section class="stack">
    <div class="head">
      <ListTools key="forehead:words" bind:query bind:sort placeholder="Search words" shown={words.length} total={deck.words.length}>
        {#snippet title()}<h3>Words <span class="faint n">{deck.words.length}</span></h3>{/snippet}
      </ListTools>
    </div>
    <form class="add" onsubmit={add}>
      <input type="text" placeholder="Type a word, press Enter" bind:value={draft} bind:this={input} enterkeyhint="done" autocapitalize="words" aria-label="New word" />
      <Button type="submit" size="sm" disabled={!draft.trim()}>Add</Button>
    </form>
    {#if removed}
      <p class="undo" role="status">Removed “{removed.word}” <button class="link" onclick={undoRemove}>Undo</button></p>
    {/if}
    {#if words.length}
      <ul class="chips">
        {#each words as w (w)}
          <li class="chip pop-in">
            <span>{w}</span>
            <button aria-label="Remove {w}" onclick={() => removeWord(w)}>
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
            </button>
          </li>
        {/each}
      </ul>
    {:else if deck.words.length}
      <p class="faint none">No words match “{query.trim()}”</p>
    {:else}
      <p class="faint">No words yet. Add them one by one, or paste a whole list.</p>
    {/if}
  </section>

  {#if deck.id}<ExportPack game="forehead" pack={deck} />{/if}
  {#if deck.id && !builtin}
    <Button variant={confirmDelete ? 'danger' : 'ghost'} onclick={remove}>{confirmDelete ? 'Tap again to delete this pack' : 'Delete pack'}</Button>
  {/if}

  {#snippet actions()}
    {#if deck.id && !builtin}<Button size="lg" onclick={() => (adding = true)}>🧙 Add more</Button>{/if}
    <Button size="lg" variant="secondary" onclick={claude} disabled={!deck.name.trim() && !deck.words.length}>📋 Paste a list</Button>
  {/snippet}
</Screen>
{/if}

<style>
  .word { font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; }
  .note {
    display: flex; flex-direction: column; align-items: flex-start; gap: var(--s-2); padding: var(--s-3) var(--s-4);
    border-radius: var(--r-md); background: var(--surface); color: var(--text-dim); font-size: 0.95rem;
  }
  .note.edited { background: color-mix(in srgb, var(--accent) 14%, var(--surface)); border: 1.5px solid color-mix(in srgb, var(--accent) 40%, transparent); }
  .note b { color: var(--accent); }
  .field { display: flex; flex-direction: column; gap: var(--s-1); }
  .lbl { font-weight: 600; color: var(--text-dim); font-size: 0.92rem; }
  .icon { display: flex; align-items: center; gap: var(--s-3); }
  .preview {
    flex: none; width: 64px; height: 64px; display: grid; place-items: center; border-radius: var(--r-md);
    background: var(--surface); font-size: 2.4rem; line-height: 1; overflow: hidden;
  }
  .icon input { flex: 1; min-width: 0; font-size: 1.4rem; }
  .hint { font-size: 0.88rem; }
  .n { font-family: var(--font-body); font-weight: 500; font-size: 0.95rem; }
  .add { display: flex; gap: var(--s-2); align-items: center; }
  .add input { flex: 1; }
  /* ListTools brings its own space below; the stack's gap already gives it. */
  .head { margin-bottom: calc(-1 * var(--s-3)); }
  .none { text-align: center; padding: var(--s-2) 0; }
  .chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { display: flex; align-items: center; gap: 2px; padding-left: var(--s-3); border-radius: var(--r-pill); background: var(--surface); min-height: 44px; }
  .chip button { width: var(--tap-min); height: var(--tap-min); border: 0; background: transparent; color: var(--text-faint); display: grid; place-items: center; border-radius: 50%; }
  .undo { display: flex; align-items: center; gap: var(--s-2); margin: 0; color: var(--text-dim); font-size: 0.92rem; }
  .undo .link { border: 0; background: transparent; color: var(--accent); font-weight: 700; min-height: var(--tap-min); padding: 0 var(--s-2); }
</style>
