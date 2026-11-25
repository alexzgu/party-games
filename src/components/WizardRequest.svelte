<script lang="ts">
  import { REQUEST_MAX } from '../lib/wizardAsk';

  // The box where a player tells Fizzwick what they want, on every game's wizard form: a request
  // in their own words, several lines if they like (Enter adds a line; the form's button starts
  // him), never a title. The pack's name is its own field on the review screen.
  let { value = $bindable(''), placeholder, id, autofocus = false }: {
    value?: string;
    /** A descriptive example request for this game, starting "e.g.". */
    placeholder: string;
    id: string;
    autofocus?: boolean;
  } = $props();

  /** The counter shows only this close to the limit. */
  const NEAR = 60;
  const left = $derived(REQUEST_MAX - value.length);
</script>

<div class="ask">
  <label class="lbl" for={id}>Tell Fizzwick what you want</label>
  <!-- svelte-ignore a11y_autofocus -->
  <textarea {id} bind:value {placeholder} rows="3" maxlength={REQUEST_MAX} enterkeyhint="enter" autocomplete="off" autocapitalize="sentences" {autofocus}></textarea>
  {#if left <= NEAR}<p class="left faint" aria-live="polite">{left} {left === 1 ? 'character' : 'characters'} left</p>{/if}
</div>

<style>
  .ask { display: flex; flex-direction: column; gap: var(--s-1); }
  .lbl { font-weight: 700; font-size: 1.1rem; }
  textarea {
    min-height: calc(3lh + 2 * var(--s-3)); max-height: calc(8lh + 2 * var(--s-3));
    field-sizing: content; overflow-y: auto; resize: none; line-height: 1.35;
  }
  .left { font-size: 0.85rem; text-align: right; margin: 0; }
</style>
