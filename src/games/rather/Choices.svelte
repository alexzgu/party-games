<script lang="ts">
  import FitText from '../../components/FitText.svelte';
  import { sides } from './rules';
  import type { Side, Tally } from './logic';

  // The question's two choices as two panels in their two fixed colours, side by side (stacked on a
  // narrow screen), each text as large as its panel allows. With `onpick` they are buttons (a
  // phone's vote; `picked` marks this phone's tap); with `tally` each shows its count, percent and
  // voters, and a split bar runs under them.
  let { prompt, size = 'md', picked, onpick, tally, name, disabled = false }: {
    prompt: string; size?: 'sm' | 'md' | 'lg'; picked?: Side; onpick?: (side: Side) => void;
    tally?: Tally; name?: (pid: string) => string; disabled?: boolean;
  } = $props();
  const texts = $derived(sides(prompt));
  const total = $derived(tally ? tally.counts[0] + tally.counts[1] : 0);
  const first = $derived(tally && total ? Math.round((100 * tally.counts[0]) / total) : 0);
  const pct = (side: Side) => side === 0 ? first : 100 - first;
  const fit = $derived(({ sm: [34, 15], md: [52, 18], lg: [120, 18] } as const)[size]);
  const SIDES: Side[] = [0, 1];
</script>

{#snippet body(side: Side)}
  <span class="text"><FitText text={texts[side]} max={fit[0]} min={fit[1]} /></span>
  {#if picked === side}<span class="mark">✓ Your pick</span>{/if}
  {#if tally}
    {#if tally.winner === side}<span class="badge">★ Bigger side · +1 each</span>{/if}
    <span class="count"><b>{tally.counts[side]}</b> {tally.counts[side] === 1 ? 'vote' : 'votes'}{total ? ` · ${pct(side)}%` : ''}</span>
    {#if name && tally.voters[side].length}<span class="names">{tally.voters[side].map(name).join(', ')}</span>{/if}
  {/if}
{/snippet}

<div class="choices {size}" class:picking={!!onpick} class:chosen={picked !== undefined} class:result={!!tally}>
  {#each SIDES as side (side)}
    {#if side === 1}<span class="or" aria-hidden="true">or</span>{/if}
    {#if onpick}
      <button class="choice" class:b={side === 1} class:on={picked === side} aria-pressed={picked === side} {disabled}
        onclick={() => onpick?.(side)}>{@render body(side)}</button>
    {:else}
      <div class="choice" class:b={side === 1} class:won={tally?.winner === side}>
        {@render body(side)}
      </div>
    {/if}
  {/each}
</div>
{#if tally && total}
  <div class="bar" role="img" aria-label="{pct(0)}% would rather {texts[0]}, {pct(1)}% would rather {texts[1]}">
    {#if tally.counts[0]}<span class="a" style:flex-grow={tally.counts[0]}>{pct(0)}%</span>{/if}
    {#if tally.counts[1]}<span class="b" style:flex-grow={tally.counts[1]}>{pct(1)}%</span>{/if}
  </div>
{/if}

<style>
  .choices { --gap: var(--s-3); display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: stretch; gap: var(--gap); }
  .choice {
    --c: var(--c-choice-a);
    display: flex; flex-direction: column; align-items: stretch; gap: var(--s-2); min-width: 0; padding: var(--s-3) var(--s-4);
    border: 3px solid transparent; border-radius: var(--r-lg); background: var(--c); color: var(--on-accent); text-align: center;
    transition: opacity var(--dur) ease, transform var(--dur) var(--ease-out), border-color var(--dur) ease;
  }
  .choice.b { --c: var(--c-choice-b); }
  .text { display: block; height: var(--text-h); }
  .sm { --text-h: clamp(64px, 14vh, 120px); }
  .md { --text-h: clamp(84px, 20vh, 190px); }
  .lg { --text-h: clamp(140px, 34vh, 420px); --gap: var(--s-4); }
  /* The reveal adds counts and names under the text: smaller text keeps it all on one screen. */
  .lg.result { --text-h: clamp(100px, 21vh, 300px); }
  .lg .choice { padding: var(--s-4) var(--s-5); }
  .or {
    align-self: center; justify-self: center; display: grid; place-items: center; width: 2.6em; height: 2.6em; border-radius: var(--r-pill);
    background: var(--surface); color: var(--text-dim); font: 800 1rem / 1 var(--font-display);
  }
  .lg .or { font-size: clamp(1rem, 2vw, 1.6rem); }
  button.choice { cursor: pointer; }
  button.choice:focus-visible { outline: 3px solid var(--text); outline-offset: 3px; }
  .picking.chosen .choice:not(.on) { opacity: 0.72; }
  .choice.on { border-color: var(--text); transform: translateY(-2px); box-shadow: var(--shadow); }
  .mark, .count, .badge { font: 800 1rem / 1.2 var(--font-display); }
  .badge { align-self: center; padding: 2px var(--s-3); border-radius: var(--r-pill); background: var(--bg); color: var(--text); }
  .lg .count { font-size: clamp(1.1rem, 2.2vw, 2rem); }
  .lg .badge { font-size: clamp(1rem, 1.6vw, 1.4rem); }
  .count b { font-size: 1.3em; }
  .names { font-weight: 600; overflow-wrap: anywhere; }
  .lg .names { font-size: clamp(1rem, 1.6vw, 1.4rem); }
  .won { border-color: var(--text); }
  .bar { display: flex; height: 2.2rem; margin-top: var(--s-3); overflow: hidden; border-radius: var(--r-pill); background: var(--surface); }
  .bar span { display: grid; place-items: center; min-width: 3.5em; color: var(--on-accent); font: 800 1rem / 1 var(--font-display); flex-basis: 0; }
  .bar .a { background: var(--c-choice-a); }
  .bar .b { background: var(--c-choice-b); }
  /* Stacked on a narrow screen (a phone, or a host window made small). */
  @media (max-width: 700px) {
    .choices { grid-template-columns: minmax(0, 1fr); }
    .lg { --text-h: clamp(90px, 18vh, 240px); }
    .or { margin-block: calc(-1 * var(--gap)); position: relative; z-index: 1; }
  }
  /* A short host window (a laptop's browser with its bars, a projector at low resolution): smaller text and tighter panels. */
  @media (max-height: 620px) {
    .lg { --text-h: clamp(80px, 26vh, 170px); }
    .lg.result { --text-h: clamp(64px, 14vh, 120px); }
    .lg .choice { gap: var(--s-1); padding: var(--s-2) var(--s-3); }
    .lg .count { font-size: 1.1rem; }
    .lg .badge, .lg .names { font-size: 0.85rem; }
    .lg .names { line-height: 1.25; }
    .result + .bar { height: 1.6rem; margin-top: var(--s-2); }
  }
  @media (prefers-reduced-motion: reduce) { .choice.on { transform: none; } }
</style>
