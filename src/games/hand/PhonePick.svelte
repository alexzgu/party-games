<script lang="ts">
  import { untrack } from 'svelte';
  import { sfx } from '../../lib/sound';
  import Filled from './Filled.svelte';
  import type { Answer } from './view';

  // Choosing an answer takes two taps, as Word Salad's pick: the first selects it (raised, the
  // others dimmed; the judge's selection also shows it large on the host) and grows a confirm
  // bar on it; the bar sends the choice. `mine`: this player's own answer, never choosable.
  let { prompt, answers, selected = null, mine, confirm, onselect, onconfirm, disabled = false }: {
    prompt: string; answers: Answer[]; selected?: number | null; mine?: number; confirm: string;
    onselect?: (i: number) => void; onconfirm: (i: number) => void; disabled?: boolean;
  } = $props();
  let chosen = $state(untrack(() => selected));

  function choose(i: number) {
    if (i === chosen || i === mine) return;
    chosen = i;
    sfx.tap();
    onselect?.(i);
  }
</script>

<div class="offers" class:choosing={chosen !== null}>
  {#each answers as a, i (i)}
    {@const on = i === chosen}
    <div class="tile" class:on class:own={i === mine}>
      <button class="face" aria-pressed={on} disabled={disabled || i === mine} onclick={() => choose(i)}>
        <Filled {prompt} answers={a.texts} />
        {#if i === mine}<span class="tag">Yours</span>{/if}
      </button>
      {#if on}
        <button class="confirm" {disabled} onclick={() => onconfirm(i)}>{confirm}</button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .offers { display: grid; gap: var(--s-2); --mark-bg: color-mix(in srgb, var(--accent) 26%, var(--surface)); }
  .tile {
    display: grid; overflow: hidden; border: 2px solid var(--line); border-radius: var(--r-lg); background: var(--surface);
    transition: transform var(--dur) var(--ease-out), opacity var(--dur) ease, border-color var(--dur) ease, box-shadow var(--dur) ease;
  }
  .choosing .tile:not(.on) { opacity: 0.55; }
  .tile.on { border-color: var(--accent); transform: translateY(-2px); box-shadow: var(--shadow); }
  .face {
    display: grid; gap: var(--s-1); min-height: var(--tap); padding: var(--s-3) var(--s-4); text-align: left;
    background: none; color: var(--text); font: 700 1.1rem / 1.3 var(--font-display);
  }
  .face:disabled { cursor: default; }
  .own { border-style: dashed; }
  .tag { color: var(--text-dim); font: 600 0.9rem / 1 var(--font-body); }
  .confirm {
    min-height: var(--tap); padding: 0 var(--s-4); background: var(--accent); color: var(--on-accent);
    font: 800 1.1rem / 1 var(--font-display); animation: grow var(--dur) var(--ease-out);
  }
  .confirm:focus-visible { outline-offset: -5px; outline-color: var(--on-accent); }
  @keyframes grow { from { opacity: 0; transform: translateY(-10px); } }
  @media (prefers-reduced-motion: reduce) { .tile.on { transform: none; } .confirm { animation: none; } }
</style>
