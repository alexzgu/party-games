<script lang="ts">
  import Button from '../../components/Button.svelte';
  import Popup from '../../components/Popup.svelte';
  import type { SnarkFinal, SnarkPack } from '../../lib/content';
  import { finalProblem } from './finals';

  // One final of a pack, in a popup: its prompt and the house's three lines, changed, added or deleted.
  let { pack, at, onsave, ondelete, onclose }: {
    pack: SnarkPack;
    at: number | 'new';
    onsave: (f: SnarkFinal) => void;
    ondelete: () => void;
    onclose: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  const start = at === 'new' ? undefined : pack.finals?.[at];
  let prompt = $state(start?.prompt ?? '');
  let house = $state([0, 1, 2].map((i) => start?.house[i] ?? ''));
  let problem = $state('');
  const EXAMPLES = ['I have a snake now', 'Define damage', 'Rent is a social construct'];

  const tidy = (s: string) => s.trim().replace(/\s+/g, ' ');
  function save(e: SubmitEvent) {
    e.preventDefault();
    const f: SnarkFinal = { prompt: tidy(prompt), house: house.map(tidy) as SnarkFinal['house'] };
    problem = finalProblem(pack, at, f);
    if (!problem) onsave(f);
  }
</script>

<Popup title={at === 'new' ? 'New final' : 'Edit final'} {onclose}>
  <form class="form" onsubmit={save} oninput={() => (problem = '')}>
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
    <Button type="submit">{at === 'new' ? 'Add final' : 'Save final'}</Button>
    {#if at !== 'new'}<Button variant="danger" onclick={ondelete}>Delete final</Button>{/if}
  </form>
</Popup>

<style>
  .form { display: flex; flex-direction: column; gap: var(--s-2); }
  .field { display: flex; flex-direction: column; gap: var(--s-1); font-weight: 600; color: var(--text-dim); }
  .problem { color: var(--bad-ink); font-weight: 600; }
</style>
