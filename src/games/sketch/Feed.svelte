<script lang="ts">
  import type { Feed } from './core';
  // The turn's guesses, newest at the bottom: "Jo: lamp", or "Jo got it!" for a right one.
  let { feed, me }: { feed: Feed[]; me?: string } = $props();
  let list = $state<HTMLOListElement>();
  $effect(() => {
    void feed.length;
    if (list) list.scrollTop = list.scrollHeight;
  });
</script>

<ol bind:this={list} aria-label="Guesses" aria-live="polite">
  {#each feed as f, i (i)}
    <li class:got={f.got} class:mine={f.pid === me}>{#if f.got}<b>{f.name}</b> got it! ✓{:else}<b>{f.name}:</b> {f.text}{/if}</li>
  {:else}
    <li class="none">No guesses yet</li>
  {/each}
</ol>

<style>
  ol { list-style: none; padding: var(--s-2); margin: 0; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; min-height: 0; background: var(--surface); border-radius: var(--r-md); overflow-wrap: anywhere; }
  li { padding: 2px var(--s-1); text-align: left; }
  .got { color: var(--c-good); font-weight: 700; }
  .mine b { color: var(--accent); }
  .none { color: var(--text-faint); }
</style>
