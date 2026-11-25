<script lang="ts">
  import InkCard from '../../components/draw/InkCard.svelte';
  import Button from '../../components/Button.svelte';
  import type { Drawing } from '../../lib/ink';
  import { GUESS_MAX } from './core';
  import { loadDraft, saveDraft } from './store';
  import WordShape from './WordShape.svelte';
  import Feed from './Feed.svelte';
  import type { View } from './view';
  // A guesser's phone in Draw & guess: the drawing as it is drawn, the word's shape, a guess box
  // and everyone's guesses. One letter off tells only this phone "Close!".
  let { v, art, me, demo = false, onguess }: {
    v: View; art: Record<string, Drawing>; me?: string; demo?: boolean; onguess: (text: string) => void;
  } = $props();
  // The parent keys this screen to the turn, so what is typed belongs to it.
  // svelte-ignore state_referenced_locally
  let draft = $state.raw(loadDraft('guess/' + v.ink));
  let box = $state<HTMLInputElement>();
  const can = $derived(!!v.guessing && !v.paused);

  function type(text: string) {
    draft = { ...draft, text };
    if (!demo) saveDraft(draft);
  }

  function send(e: SubmitEvent) {
    e.preventDefault();
    const text = draft.text.trim();
    if (!text || !can) return;
    onguess(text);
    type('');
    box?.focus();
  }
</script>

<div class="pic"><InkCard drawing={v.ink ? art[v.ink] ?? [] : []} label="The drawing so far" /></div>
<WordShape shape={v.shape} word={v.word} />
{#if v.close && v.guessing}<p class="close" role="status">“{v.close}” is close!</p>{/if}
{#if v.guessing}
  <form onsubmit={send}>
    <input bind:this={box} maxlength={GUESS_MAX} placeholder="Type a guess" aria-label="Your guess" value={draft.text} disabled={!can}
      autocomplete="off" autocapitalize="off" enterkeyhint="send" oninput={(e) => type(e.currentTarget.value)} />
    <Button type="submit" disabled={!can || !draft.text.trim()}>Guess</Button>
  </form>
{:else if v.word}<p class="note">You got it! Watch the others guess.</p>{/if}
<div class="feed"><Feed feed={v.feed ?? []} {me} /></div>

<style>
  .pic { width: min(100%, max(160px, 100dvh - 400px * var(--chrome-scale))); margin-inline: auto; }
  form { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--s-2); align-items: center; }
  input { min-height: 44px; min-width: 0; }
  .close { color: var(--c-pass); font-weight: 800; text-align: center; }
  .note { color: var(--text-dim); text-align: center; }
  /* The room left under the pad (the screen fits the phone: Phone.svelte); the list is as tall as its
     guesses up to that room, and scrolls inside it past that, newest at the bottom. */
  .feed { flex: 1 1 0; min-height: 3.5em; display: flex; flex-direction: column; }
  .feed :global(ol) { flex: 0 1 auto; min-height: 3.5em; max-height: 24dvh; }
</style>
