<script lang="ts">
  import Popup from '../../components/Popup.svelte';
  import Button from '../../components/Button.svelte';
  import { cleanPrompt, promptError } from './parse';

  // Add or edit one prompt. Saving tidies it the same way a pasted one is and says what is wrong.
  let { prompt, others, onsave, ondelete, onclose }: {
    /** The prompt being edited, or null for a new one. */
    prompt: string | null;
    /** The pack's other prompts, so none is in it twice. */
    others: string[];
    onsave: (prompt: string) => void;
    ondelete?: () => void;
    onclose: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let text = $state(prompt ?? '');
  let error = $state('');
  let deleting = $state(false);

  function save(e: SubmitEvent) {
    e.preventDefault();
    const p = cleanPrompt(text);
    error = promptError(p, others);
    if (!error) onsave(p);
  }
</script>

<Popup title={prompt ? 'Edit prompt' : 'New prompt'} {onclose}>
  <form class="form" onsubmit={save} oninput={() => (error = '')}>
    <label>
      <span>Name 3 …</span>
      <input type="text" bind:value={text} placeholder="things you'd find in a fridge" maxlength="90" autocomplete="off" autocapitalize="none" enterkeyhint="done" />
    </label>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <Button type="submit" size="lg" guardMs={0}>{prompt ? 'Save prompt' : 'Add prompt'}</Button>
    {#if ondelete}
      <Button variant={deleting ? 'danger' : 'ghost'} guardMs={0} onclick={() => (deleting ? ondelete() : (deleting = true))}>
        {deleting ? 'Really delete?' : 'Delete prompt'}
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
