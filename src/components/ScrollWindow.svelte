<script lang="ts">
  import { tick, type Snippet } from 'svelte';
  import { watchEdges } from '../lib/panel';

  // A part of a pack page's pinned top that grows (players, teams) shown in a window about
  // `rows` rows tall that scrolls on its own. Its top and bottom edges fade out only where there is
  // more to scroll that way. A short screen shows fewer rows, down to one (the screen's height less
  // `room`, what the rest of the page needs). `toEnd()` scrolls to the last row (a player just added).
  let { rows = 3, row = 52, room = 590, children }: {
    /** How many rows show at most (a fraction peeks at the next one). */
    rows?: number;
    /** One row's height in px (rows are `--window-gap` apart). */
    row?: number;
    /** The rest of the page's height in px, roughly: the window gets what the screen has beyond it. */
    room?: number;
    children: Snippet;
  } = $props();

  let box: HTMLDivElement;
  let above = $state(false);
  let below = $state(false);
  $effect(() => watchEdges(box, (e) => { above = e.above; below = e.below; }));

  // A screen that shrinks (a keyboard opening on some phones) shows fewer rows: the name being
  // typed stays in view.
  function keepFocus() {
    const el = document.activeElement;
    if (el instanceof HTMLElement && box.contains(el)) el.scrollIntoView({ block: 'nearest' });
  }

  export async function toEnd(): Promise<void> {
    await tick(); // after the new row is drawn
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    box.scrollTo({ top: box.scrollHeight, behavior: still ? 'auto' : 'smooth' });
  }
</script>

<svelte:window onresize={keepFocus} />

<div class="scroll-window" class:above class:below style:--rows={rows} style:--row="{row}px" style:--room="{room}px" bind:this={box}>
  {@render children()}
</div>

<style>
  .scroll-window {
    --fade: min(28px, 20%); --window-gap: var(--s-2);
    max-height: clamp(var(--row), 100dvh - var(--room), var(--rows) * var(--row) + (var(--rows) - 1) * var(--window-gap));
    overflow-y: auto;
    /* What scrolls into view (a renamed row, a focused name) stops clear of the fades. */
    scroll-padding-block: var(--fade);
    /* Room for the inputs' focus glow, which the window would otherwise cut. */
    margin: -4px; padding: 4px;
  }
  .above, .below {
    --top: 0px; --bottom: 0px;
    -webkit-mask-image: linear-gradient(to bottom, transparent, #000 var(--top), #000 calc(100% - var(--bottom)), transparent);
    mask-image: linear-gradient(to bottom, transparent, #000 var(--top), #000 calc(100% - var(--bottom)), transparent);
  }
  .above { --top: var(--fade); }
  .below { --bottom: var(--fade); }
</style>
