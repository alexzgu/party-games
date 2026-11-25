<script lang="ts">
  import { linesShown } from './logic';
  import type { Choice } from './view';

  // A three-line duel's lines appearing as on the host screen: side A's one at a time, then
  // side B's (all at once with reduced motion). Timed from the host's timer, so a phone that
  // reconnects mid-way lands in step.
  let { prompt, sides, left, span }: { prompt: string; sides: Choice[]; left: number | null; span: number } = $props();

  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const all = $derived(sides.map((s) => s.lines ?? [s.text]));
  const counts = $derived(reduced || left === null ? [all[0].length, all[1].length] : linesShown([all[0].length, all[1].length], span - left));
</script>

<div class="show">
  <p class="step">Final duel</p>
  <h2 class="prompt">{prompt}</h2>
  {#each sides as s, i (s.id)}
    <ol class="side" class:empty={s.empty} aria-label="Answer {i + 1}">
      {#each all[i].slice(0, counts[i]) as line, k (k)}<li class="pop-in">{line}</li>{/each}
    </ol>
    {#if i === 0}<p class="vs" aria-hidden="true">vs</p>{/if}
  {/each}
  <p class="muted note">Voting opens in a moment.</p>
</div>

<style>
  .show { display: flex; flex-direction: column; gap: var(--s-3); }
  .step { color: var(--c-gold); font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.82rem; }
  .prompt { font-size: clamp(1.25rem, calc(5.6vw * var(--text-scale)), 1.7rem); line-height: 1.15; }
  .side {
    list-style: none; margin: 0; padding: var(--s-3) var(--s-4); min-height: 104px; display: flex; flex-direction: column; justify-content: center; gap: var(--s-2);
    border-radius: var(--r-lg); background: var(--surface); border: 2.5px solid var(--line-strong);
  }
  .side li { font-family: var(--font-display); font-weight: 800; font-size: 1.15rem; line-height: 1.2; overflow-wrap: anywhere; }
  .empty li { color: var(--text-faint); font-style: italic; }
  .vs { text-align: center; font-family: var(--font-display); font-weight: 800; color: var(--text-faint); }
  .note { text-align: center; }
</style>
