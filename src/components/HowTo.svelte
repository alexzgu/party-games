<script lang="ts">
  import type { Snippet } from 'svelte';
  import Popup from './Popup.svelte';

  // The "?" button for a screen header (Screen's `trailing` slot): opens the rules in a popup.
  let { title = 'How to play', children }: { title?: string; children: Snippet } = $props();
  let open = $state(false);
</script>

<button class="q" aria-label={title} onclick={() => (open = true)}>?</button>
{#if open}
  <Popup {title} onclose={() => (open = false)}><div class="rules">{@render children()}</div></Popup>
{/if}

<style>
  .q {
    width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center;
    font-weight: 800; font-size: 1.25rem; color: var(--accent); background: rgb(255 255 255 / 0.08);
  }
  .rules :global(ol), .rules :global(ul) { padding-left: 1.2em; display: flex; flex-direction: column; gap: var(--s-2); }
  .rules :global(p) { margin: 0 0 var(--s-3); }
  .rules :global(b) { color: var(--accent); }
</style>
