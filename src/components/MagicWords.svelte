<script lang="ts">
  import { onDestroy } from 'svelte';
  import Button from './Button.svelte';
  import { hasKey } from '../lib/claude';
  import { sayWords } from '../lib/magicWords';
  import { WIZARD_SERVER } from '../lib/wizardServer';
  import { sfx } from '../lib/sound';

  // The magic words box, wherever the wizard is wanted: Settings and every make page. The words
  // go once to the wizard server, which answers with a pass kept on this phone (never the words
  // themselves, never in a URL). Players are only told about the magic words; an invite link or
  // bare key typed here still works, for the host's own testing. Once Fizzwick is on the phone the
  // box goes away (a make page then shows his form in its place). Without a wizard server there
  // are no magic words: the box is only the host's way to put a key on the phone. `demo` (the
  // how-to screens) shows the box but never sends anything.
  let { intro = '🧙 Fizzwick the Wizard is not on this phone yet. Say the magic words the host told you:', demo = false }: { intro?: string; demo?: boolean } = $props();

  const hasServer = !!WIZARD_SERVER;
  let words = $state('');
  let show = $state(false);
  let saying = $state(false);
  let note = $state('');
  let ok = $state(false);
  // Leaving the page cancels words still out, so a late answer saves nothing.
  const gone = new AbortController();
  onDestroy(() => gone.abort());

  async function say() {
    if (demo || !words.trim() || saying) return;
    note = '';
    saying = true;
    const said = await sayWords(words, gone.signal);
    saying = false;
    if (!said) return;
    ok = said.ok;
    note = said.message;
    if (!said.ok) return;
    words = '';
    show = false;
    sfx.correct();
  }
</script>

{#if demo || !hasKey()}
  <div class="stack magic">
    <p class="muted small">{hasServer ? intro : "🧙 Fizzwick the Wizard is not on this phone yet. Ask the host."}</p>
    <div class="words">
      <input type={show ? 'text' : 'password'} placeholder={hasServer ? 'The magic words: a word or a few' : "For the host: the wizard's key"} autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go"
        maxlength="400" bind:value={words} oninput={() => (note = '')} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void say(); } }} aria-label={hasServer ? 'Magic words' : "The host's key"} />
      <button type="button" class="show" onclick={() => (show = !show)} aria-pressed={show} data-tip={show ? 'Hides what you typed behind dots' : 'Shows what you typed'}>{show ? 'Hide' : 'Show'}</button>
    </div>
    <Button variant="secondary" onclick={say} disabled={demo || !words.trim() || saying} tip={hasServer ? 'Checks the words; the right ones bring Fizzwick to this device' : 'Saves the key on this device'}>{saying ? 'Listening…' : hasServer ? 'Say them' : 'Save it'}</Button>
  </div>
{/if}
{#if !demo && note && (!ok || hasKey())}<p class="status" class:ok class:err={!ok} role="status">{note}</p>{/if}

<style>
  .small { font-size: 0.92rem; }
  .words { display: flex; gap: var(--s-2); }
  .words input { flex: 1; min-width: 0; }
  .show { min-height: var(--tap); padding: 0 var(--s-3); border: 1.5px solid var(--line-strong); border-radius: var(--r-md); background: var(--surface); color: var(--text-dim); font-weight: 600; }
  .status { padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: var(--surface); }
  .status.ok { color: var(--c-good); }
  .status.err { color: color-mix(in srgb, var(--c-bad) 55%, var(--text)); }
</style>
