<script lang="ts">
  // One card's fields: the word and its five banned words. Checked with the same rules as the
  // built-in packs (cards.ts) when saved; `onsave` may refuse it with a reason (e.g. a repeat).
  import Button from '../../components/Button.svelte';
  import type { TabooCard } from '../../lib/content';
  import { BANNED_COUNT, cardProblems, clean, tidy } from './cards';

  let { card, submit, onsave, oncancel, ondelete, focusId }: {
    card?: TabooCard;
    submit: string;
    /** Returns why the card was refused, or '' when it was saved. */
    onsave: (c: TabooCard) => string;
    oncancel?: () => void;
    ondelete?: () => void;
    /** id for the word field, so the parent can focus it after adding. */
    focusId?: string;
  } = $props();

  // svelte-ignore state_referenced_locally
  let word = $state(card?.word ?? '');
  // svelte-ignore state_referenced_locally
  let banned = $state(Array.from({ length: BANNED_COUNT }, (_, i) => card?.banned[i] ?? ''));
  let error = $state('');
  const filled = $derived(!!clean(word) && banned.every((b) => clean(b)));

  function save(e: SubmitEvent) {
    e.preventDefault();
    const c = tidy({ word, banned });
    error = cardProblems(c)[0] ?? onsave(c);
    if (!error && !card) {
      word = '';
      banned = banned.map(() => '');
      document.getElementById(focusId ?? '')?.focus();
    }
  }
  /** Delete takes a second tap, so a card is never lost to a slip. */
  let sure = $state(false);
</script>

<form class="form" onsubmit={save}>
  <input id={focusId} class="word" type="text" maxlength="40" autocomplete="off" placeholder="Word to describe, e.g. Pizza" aria-label="Word to describe"
    bind:value={word} oninput={() => (error = '')} />
  <div class="banned">
    {#each banned as _, i (i)}
      <input type="text" maxlength="30" autocomplete="off" placeholder="Don't say {i + 1}" aria-label="Banned word {i + 1}"
        enterkeyhint={i === BANNED_COUNT - 1 ? 'done' : 'next'} bind:value={banned[i]} oninput={() => (error = '')} />
    {/each}
  </div>
  {#if error}<p class="err" role="alert">{error}</p>
  {:else if !filled && !card}<p class="faint fill">Fill in the word and all {BANNED_COUNT} banned words to add it.</p>{/if}
  <div class="buttons">
    <Button type="submit" variant={card ? 'primary' : 'secondary'} size={card ? 'sm' : 'md'} disabled={!filled}>{submit}</Button>
    {#if oncancel}<Button variant="ghost" size="sm" onclick={oncancel}>Cancel</Button>{/if}
    {#if ondelete}<span class="grow"></span><Button variant="danger" size="sm" onclick={() => (sure ? ondelete() : (sure = true))}>{sure ? 'Tap again to delete' : 'Delete'}</Button>{/if}
  </div>
</form>

<style>
  .fill { font-size: 0.88rem; margin: 0; }
  .form { display: flex; flex-direction: column; gap: var(--s-2); }
  .word { font-weight: 800; font-family: var(--font-display); font-size: 1.15rem; }
  .banned { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-2); }
  .banned input { min-height: 48px; padding: var(--s-2) var(--s-3); }
  .err { color: var(--bad-ink); font-weight: 600; font-size: 0.92rem; }
  .buttons { display: flex; align-items: center; gap: var(--s-2); flex-wrap: wrap; }
</style>
