<script lang="ts">
  import { CHOICES, type Choice } from './logic';
  import { MARKS } from './labels';

  // The question's four answers as four tiles in four fixed colours, each with its letter (A to D)
  // so colour is never the only cue; two by two (stacked on a narrow screen). With `onpick`
  // they are buttons (a phone's answer; `picked` marks this phone's tap, and once it is made the
  // others dim). With `right` the reveal: the right one marked, the rest dimmed, and with `counts`
  // how many picked each.
  let { answers, size = 'md', picked, onpick, right, counts, disabled = false }: {
    answers: readonly string[]; size?: 'sm' | 'md' | 'lg'; picked?: Choice; onpick?: (c: Choice) => void;
    right?: Choice; counts?: readonly number[]; disabled?: boolean;
  } = $props();
  const revealed = $derived(right !== undefined);
</script>

{#snippet body(c: Choice)}
  <span class="letter"><span>{MARKS[c]}</span><span class="sr">:</span></span>
  <span class="text">{answers[c]}</span>
  {#if revealed || picked === c || counts}
    <span class="tags">
      {#if right === c}<b class="tag">✓ Right</b>{/if}
      {#if picked === c}<b class="tag mine">{revealed ? 'Your answer' : '✓ Your answer'}</b>{/if}
      {#if counts}<span class="count">{counts[c]} {counts[c] === 1 ? 'pick' : 'picks'}</span>{/if}
    </span>
  {/if}
{/snippet}

<div class="answers {size}" class:picking={!!onpick} class:chosen={picked !== undefined} class:revealed role={onpick ? 'group' : 'list'} aria-label="Answers">
  {#each CHOICES as c (c)}
    {#if onpick}
      <button class="answer a{c + 1}" class:on={picked === c} class:right={right === c} aria-pressed={picked === c}
        disabled={disabled || picked !== undefined} onclick={() => onpick?.(c)}>{@render body(c)}</button>
    {:else}
      <div class="answer a{c + 1}" class:on={picked === c} class:right={right === c} role="listitem">{@render body(c)}</div>
    {/if}
  {/each}
</div>

<style>
  .answers { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-2); }
  .answer {
    --c: var(--c-answer-1);
    display: flex; align-items: center; gap: var(--s-3); min-width: 0; min-height: var(--tap-lg); padding: var(--s-2) var(--s-3);
    border: 3px solid transparent; border-radius: var(--r-md); background: var(--c); color: var(--ink, var(--on-accent)); text-align: left;
    font-weight: 800; line-height: 1.2; transition: opacity var(--dur) ease, transform var(--dur) var(--ease-out);
  }
  .a2 { --c: var(--c-answer-2); }
  .a3 { --c: var(--c-answer-3); --ink: var(--c-answer-3-ink, var(--on-accent)); }
  .a4 { --c: var(--c-answer-4); }
  .letter { flex: none; display: grid; place-items: center; width: 1.9em; height: 1.9em; border-radius: var(--r-pill); background: color-mix(in srgb, currentColor 18%, transparent); font: 800 1rem / 1 var(--font-display); }
  .text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
  .tags { flex: none; display: flex; flex-direction: column; align-items: flex-end; gap: 2px; text-align: right; }
  .tag { padding: 1px var(--s-2); border-radius: var(--r-pill); background: var(--bg); color: var(--text); font: 800 0.85rem / 1.3 var(--font-display); white-space: nowrap; }
  .count { font: 800 0.95rem / 1.2 var(--font-display); white-space: nowrap; }
  .sm .answer { min-height: var(--tap-sm); padding: var(--s-1) var(--s-2); font-size: 0.95rem; }
  .md .answer { min-height: var(--tap-xxl); font-size: 1.1rem; }
  .lg { gap: var(--s-3); }
  .lg .answer { min-height: clamp(64px, 11vh, 140px); padding: var(--s-2) var(--s-4); font-size: clamp(calc(1.1 * var(--rem-far)), 2.3vw, calc(2.2 * var(--rem-far))); }
  .lg .letter { font-size: clamp(var(--rem-far), 1.8vw, calc(1.6 * var(--rem-far))); }
  .lg .tag { font-size: clamp(calc(0.85 * var(--rem-far)), 1.3vw, calc(1.2 * var(--rem-far))); }
  .lg .count { font-size: clamp(calc(0.95 * var(--rem-far)), 1.5vw, calc(1.4 * var(--rem-far))); }
  button.answer { cursor: pointer; }
  button.answer:focus-visible { outline: 3px solid var(--text); outline-offset: 3px; }
  button.answer:disabled { cursor: default; }
  .picking.chosen .answer:not(.on), .revealed .answer:not(.right) { opacity: 0.6; }
  .revealed .answer.on:not(.right) { opacity: 0.8; }
  .answer.on { border-color: var(--text); }
  .answer.right { border-color: var(--text); box-shadow: 0 0 0 3px var(--c-good); }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  @media (max-width: 520px) { .answers:not(.lg) { grid-template-columns: minmax(0, 1fr); } }
  @media (max-width: 700px) { .lg { grid-template-columns: minmax(0, 1fr); } }
  @media (max-height: 620px) { .lg .answer { min-height: var(--tap-sm); padding: var(--s-1) var(--s-3); font-size: clamp(var(--rem-far), 2vw, calc(1.4 * var(--rem-far))); } }
  @media (prefers-reduced-motion: reduce) { .answer { transition: none; } }
</style>
