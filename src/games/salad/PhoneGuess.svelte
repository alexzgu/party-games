<script lang="ts">
  import { untrack } from 'svelte';
  import Button from '../../components/Button.svelte';
  import { load, remove, save } from '../../lib/storage';
  import { GUESS_MAX } from './protocol';

  let { draftKey, onsend, persist = true }: { draftKey: string; onsend: (text: string) => void; persist?: boolean } = $props();
  const storageKey = 'salad:guess';
  const initial = untrack(() => persist ? load(storageKey, { turn: '', text: '' }) : null);
  let text = $state(initial?.turn === untrack(() => draftKey) && typeof initial.text === 'string' ? initial.text : '');
  let input = $state<HTMLInputElement>();

  function submit(e: SubmitEvent) {
    e.preventDefault();
    const guess = text.trim();
    if (!guess) return;
    onsend(guess);
    text = '';
    if (persist) remove(storageKey);
    input?.focus({ preventScroll: true });
  }
</script>

<form onsubmit={submit}>
  <label for="salad-guess">Your guess</label>
  <div class="row">
    <input id="salad-guess" bind:this={input} type="text" enterkeyhint="send" autocomplete="off" spellcheck="false" value={text} maxlength={GUESS_MAX}
      oninput={(e) => { text = e.currentTarget.value; if (persist) save(storageKey, { turn: draftKey, text }); }} />
    <Button type="submit" size="sm" guardMs={0} disabled={!text.trim()}>Send</Button>
  </div>
</form>

<style>
  form { display: grid; gap: var(--s-1); padding: var(--s-2) 0; }
  label { font-weight: 700; }
  .row { display: flex; align-items: center; gap: var(--s-2); }
  input { flex: 1; min-width: 0; }
</style>
