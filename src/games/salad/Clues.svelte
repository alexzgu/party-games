<script lang="ts">
  let { sentences }: { sentences: string[] } = $props();
  let scroll = $state<HTMLOListElement>();
  $effect(() => {
    // Leave the newest clue in view as sentences stack up.
    if (sentences.length && scroll) scroll.scrollTop = scroll.scrollHeight;
  });
</script>

<ol bind:this={scroll} aria-label="Sentences" aria-live="polite" aria-relevant="additions">
  {#each sentences as sentence, index (index)}
    <li class:latest={index === sentences.length - 1}>{sentence}</li>
  {/each}
</ol>

<style>
  ol {
    display: grid; align-content: start; gap: var(--s-2); margin: 0; padding: 0; list-style: none;
    overflow: auto; min-height: 0; max-height: var(--clues-height, 40dvh);
  }
  li {
    color: var(--text-dim); background: var(--surface); border: 2px solid var(--line);
    border-radius: var(--r-lg); padding: var(--s-3) var(--s-4); overflow-wrap: anywhere;
    font: 700 var(--clue-size, 1.25rem) / 1.18 var(--font-display);
  }
  .latest { color: var(--text); border-color: var(--accent); }
</style>
