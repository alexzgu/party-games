<script lang="ts">
  import Filled from './Filled.svelte';
  import type { Answer } from './view';

  // The played answers as filled-in prompts, read-only: the host screen and the phones of
  // everyone not choosing. At the reveal each shows who played it (and the votes, after a vote).
  let { prompt, answers, spotlight = null, winner = null, votes, mine, name, size = 'md' }: {
    prompt: string; answers: Answer[]; spotlight?: number | null; winner?: number | null;
    votes?: number[]; mine?: number; name: (pid: string) => string; size?: 'md' | 'lg';
  } = $props();
</script>

<ol class="answers {size}" class:dimmed={spotlight !== null && winner === null}>
  {#each answers as a, i (i)}
    <li class:on={spotlight === i} class:won={winner === i}>
      <Filled {prompt} answers={a.texts} />
      {#if a.by || mine === i || votes}
        <p class="by">
          {#if winner === i}<b>Winner ·</b>{/if}
          {#if a.by}{name(a.by)}{:else if mine === i}Yours{/if}
          {#if votes}· {votes[i]} {votes[i] === 1 ? 'vote' : 'votes'}{/if}
        </p>
      {/if}
    </li>
  {/each}
</ol>

<style>
  .answers {
    list-style: none; padding: 0; margin: 0; display: grid; gap: var(--s-2);
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
    --mark-bg: color-mix(in srgb, var(--accent) 26%, var(--surface)); --mark-text: var(--text);
  }
  li {
    display: grid; align-content: space-between; gap: var(--s-2); padding: var(--s-3) var(--s-4);
    border: 2px solid var(--line); border-radius: var(--r-lg); background: var(--surface);
    font: 700 1.05rem / 1.3 var(--font-display);
    transition: opacity var(--dur) ease, border-color var(--dur) ease, transform var(--dur) var(--ease-out);
  }
  .lg li { font-size: clamp(calc(1.05 * var(--rem-far)), 2.2vw, calc(2 * var(--rem-far))); }
  .lg { grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); }
  .dimmed li:not(.on) { opacity: 0.55; }
  li.on { border-color: var(--accent); transform: translateY(-2px); }
  li.won { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 40%, transparent); }
  .by { font: 600 0.95rem / 1.2 var(--font-body); color: var(--text-dim); }
  .lg .by { font-size: clamp(calc(0.9 * var(--rem-far)), 1.4vw, calc(1.25 * var(--rem-far))); }
  .by b { color: var(--accent); }
  @media (prefers-reduced-motion: reduce) { li.on { transform: none; } }
</style>
