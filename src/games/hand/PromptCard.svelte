<script lang="ts">
  import Filled from './Filled.svelte';

  // A prompt card, with the played answers (or a phone's selection) in its blanks. Our look: a
  // rounded card in the game's green with the answers set in as raised chips. `size` scales the
  // type for the host screen.
  let { prompt, answers = [], size = 'md', label }: {
    prompt: string; answers?: readonly string[]; size?: 'sm' | 'md' | 'lg' | 'xl'; label?: string;
  } = $props();
</script>

<div class="prompt {size}">
  {#if label}<span class="label">{label}</span>{/if}
  <Filled {prompt} {answers} />
</div>

<style>
  .prompt {
    display: grid; gap: var(--s-2); padding: var(--s-4); border-radius: var(--r-lg);
    background: linear-gradient(160deg, color-mix(in srgb, var(--accent) 86%, white), var(--accent));
    color: var(--on-accent); box-shadow: var(--shadow);
    font: 800 1.25rem / 1.3 var(--font-display);
  }
  .label { font: 700 0.8rem / 1.2 var(--font-body); text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.85; }
  .sm { font-size: 1.05rem; padding: var(--s-3); border-radius: var(--r-md); box-shadow: none; }
  .lg { font-size: clamp(calc(1.4 * var(--rem-far)), 3.4vw, calc(3 * var(--rem-far))); }
  .xl { font-size: clamp(calc(1.6 * var(--rem-far)), 4.4vw, calc(4 * var(--rem-far))); line-height: 1.2; }
  .lg, .xl { padding: clamp(var(--s-4), 3vw, var(--s-7)); }
  .lg .label, .xl .label { font-size: clamp(calc(0.8 * var(--rem-far)), 1.4vw, calc(1.2 * var(--rem-far))); }
</style>
