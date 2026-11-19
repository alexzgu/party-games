<script lang="ts">
  import Popup from '../../components/Popup.svelte';
  import Button from '../../components/Button.svelte';
  import type { GibberishCard } from '../../lib/content';
  import { checkCard } from './parse';

  // Add or edit one card. Saving runs the same checks as a pasted card and says what is wrong.
  let { card, others, categories, onsave, ondelete, onclose }: {
    /** The card being edited, or null for a new one. */
    card: GibberishCard | null;
    /** The pack's other cards, so an answer is never in it twice. */
    others: GibberishCard[];
    /** Categories already in use, offered while typing. */
    categories: string[];
    onsave: (card: GibberishCard) => void;
    ondelete?: () => void;
    onclose: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let phrase = $state(card?.phrase ?? '');
  // svelte-ignore state_referenced_locally
  let answer = $state(card?.answer ?? '');
  // svelte-ignore state_referenced_locally
  let hint = $state(card?.hint ?? '');
  let error = $state('');
  let deleting = $state(false);

  function save(e: SubmitEvent) {
    e.preventDefault();
    const r = checkCard({ phrase, answer, hint }, others);
    if (r.card) onsave(r.card);
    else error = r.error;
  }
</script>

<Popup title={card ? 'Edit card' : 'New card'} {onclose}>
  <form class="form" onsubmit={save} oninput={() => (error = '')}>
    <label>
      <span>Phrase (what the reader says)</span>
      <input type="text" bind:value={phrase} placeholder="Eye Scream" maxlength="80" autocomplete="off" />
    </label>
    <label>
      <span>Answer (what it sounds like)</span>
      <input type="text" bind:value={answer} placeholder="Ice Cream" maxlength="70" autocomplete="off" />
    </label>
    <label>
      <span>Category (optional)</span>
      <input type="text" bind:value={hint} placeholder="Food" maxlength="30" autocomplete="off" list="gib-categories" />
    </label>
    <datalist id="gib-categories">
      {#each categories as c (c)}<option value={c}></option>{/each}
    </datalist>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <Button type="submit" size="lg" guardMs={0}>{card ? 'Save card' : 'Add card'}</Button>
    {#if ondelete}
      <Button variant={deleting ? 'danger' : 'ghost'} guardMs={0} onclick={() => (deleting ? ondelete() : (deleting = true))}>
        {deleting ? 'Tap again to delete this card' : 'Delete card'}
      </Button>
    {/if}
  </form>
</Popup>

<style>
  .form { display: flex; flex-direction: column; gap: var(--s-3); }
  label { display: flex; flex-direction: column; gap: var(--s-1); font-weight: 600; color: var(--text-dim); }
  .error {
    margin: 0; padding: var(--s-3) var(--s-4); border-radius: var(--r-md); font-weight: 600;
    background: color-mix(in srgb, var(--c-bad) 18%, var(--surface)); border: 1.5px solid color-mix(in srgb, var(--c-bad) 60%, transparent);
  }
</style>
