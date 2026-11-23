<script lang="ts">
  import Button from '../../components/Button.svelte';
  import Popup from '../../components/Popup.svelte';
  import type { SnarkFinal } from '../../lib/content';

  // One final of a pack, in a popup: its prompt and the house's three lines, changed, added or deleted.
  // What is typed stays while it could not be saved.
  let { was, save, onclose }: {
    /** The final as it reads now; null for a new one. */
    was: SnarkFinal | null;
    /** Saves it (null: deletes it), or says why not. */
    save: (f: SnarkFinal | null) => string;
    onclose: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let prompt = $state(was?.prompt ?? '');
  // svelte-ignore state_referenced_locally
  let house = $state([0, 1, 2].map((i) => was?.house[i] ?? ''));
  let problem = $state('');
  const EXAMPLES = ['I have a snake now', 'Define damage', 'Rent is a social construct'];

  const tidy = (s: string) => s.trim().replace(/\s+/g, ' ');
  function submit(e: SubmitEvent) {
    e.preventDefault();
    problem = save({ prompt: tidy(prompt), house: house.map(tidy) as SnarkFinal['house'] });
  }
</script>

<Popup title={was ? 'Edit final' : 'New final'} {onclose}>
  <form class="form" onsubmit={submit} oninput={() => (problem = '')}>
    <label class="field">
      <span>Prompt that asks for three things (3 to 14 words)</span>
      <textarea bind:value={prompt} rows="3" maxlength="200" placeholder="Three things you should never say to your landlord"></textarea>
    </label>
    {#each house as _, i (i)}
      <label class="field">
        <span>House line {i + 1}</span>
        <input type="text" bind:value={house[i]} maxlength="120" autocomplete="off" placeholder={EXAMPLES[i]} />
      </label>
    {/each}
    {#if problem}<p class="problem" role="alert">{problem}</p>{/if}
    <Button type="submit">{was ? 'Save final' : 'Add final'}</Button>
    {#if was}<Button variant="danger" onclick={() => (problem = save(null))}>Delete final</Button>{/if}
  </form>
</Popup>

<style>
  .form { display: flex; flex-direction: column; gap: var(--s-2); }
  .field { display: flex; flex-direction: column; gap: var(--s-1); font-weight: 600; color: var(--text-dim); }
  .problem { color: var(--bad-ink); font-weight: 600; }
</style>
