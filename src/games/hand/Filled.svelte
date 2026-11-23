<script lang="ts">
  import { BLANK, blanks, fill } from './cards';

  // A prompt read with answers in its blanks: the answers stand out as chips (a question's
  // answer goes on the line under it). The surrounding card sets the type and colours.
  let { prompt, answers = [] }: { prompt: string; answers?: readonly string[] } = $props();
  const parts = $derived(fill(prompt, answers));
  const question = $derived(!blanks(prompt));
</script>

<!-- One line: whitespace between the parts would show between a word and its full stop. -->
<p class="filled">{#each parts as part, i (i)}{#if part.filled}{#if question}<br />{/if}<mark>{part.text}</mark>{:else if part.text === BLANK}<span class="gap" aria-label="blank"></span>{:else}{part.text}{/if}{/each}</p>

<style>
  .filled { overflow-wrap: anywhere; }
  mark {
    color: var(--mark-text, var(--text)); background: var(--mark-bg, var(--bg-raised)); padding: 0 0.25em; border-radius: 0.3em;
    box-decoration-break: clone; -webkit-box-decoration-break: clone;
  }
  .gap { display: inline-block; width: 3.5em; height: 0.9em; vertical-align: -0.1em; border-bottom: 0.12em solid currentColor; }
</style>
