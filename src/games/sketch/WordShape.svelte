<script lang="ts">
  // The word to guess as boxes, one per letter (shown once a hint gives it), with the gaps between
  // words and any hyphen or apostrophe; or the word itself for those who know it.
  let { shape, word, size = 'md' }: { shape?: string; word?: string; size?: 'md' | 'lg' } = $props();
  const words = $derived((shape ?? '').split(' '));
  const letters = $derived((shape ?? '').replace(/[^_\p{L}\d]/gu, '').length);
</script>

{#if word}
  <p class="word {size}">{word}</p>
{:else if shape}
  <p class="shape {size}" aria-label="{letters} letters{shape.includes(' ') ? `, ${words.length} words` : ''}">
    {#each words as w, i (i)}
      <span class="w">{#each [...w] as ch, j (j)}<span class:box={ch === '_' || /[\p{L}\d]/u.test(ch)}>{ch === '_' ? '' : ch}</span>{/each}</span>
    {/each}
    <small>{letters}</small>
  </p>
{/if}

<style>
  .word { font: 800 clamp(1.4rem, calc(6vw * var(--text-scale)), 2.4rem)/1.1 var(--font-display); color: var(--accent); text-align: center; overflow-wrap: anywhere; }
  .shape { display: flex; flex-wrap: wrap; justify-content: center; align-items: end; gap: var(--s-1) var(--s-3); }
  .w { display: flex; flex-wrap: wrap; gap: 3px; align-items: end; }
  .w > span { min-width: 0.6em; text-align: center; font: 800 1.3rem/1 var(--font-display); }
  .box { width: 1.15em; height: 1.5em; display: grid !important; place-items: center; border-bottom: 3px solid var(--text); }
  .lg .w > span { font-size: clamp(1.4rem, calc(4vmin * var(--text-scale)), 2.4rem); }
  small { color: var(--text-dim); align-self: center; }
</style>
