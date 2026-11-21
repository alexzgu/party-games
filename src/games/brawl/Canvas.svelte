<script lang="ts">
  import { onDestroy } from 'svelte';
  import { SIZE, MAX_POINTS, PALETTE, WIDTHS, point, append, pointCount, paint, type Point, type Drawing } from './ink';
  let { drawing, onchange, disabled = false }: {
    drawing: Drawing; onchange: (d: Drawing) => void; disabled?: boolean;
  } = $props();
  let canvas = $state<HTMLCanvasElement>();
  let width = $state(0);
  let colour = $state(0);
  let pen = $state<number>(WIDTHS[0]);
  let pointer: number | null = null;
  let last: Point = [0, 0];
  let overflow = '';
  let count = 0;
  let working: Drawing = [];
  /** The drawing as it was before Clear, so Undo can bring it back until the next stroke. */
  let cleared = $state<Drawing | null>(null);
  const full = $derived(pointCount(drawing) >= MAX_POINTS);

  $effect(() => {
    if (canvas && width) paint(canvas, drawing, Math.round(width * devicePixelRatio));
  });

  function locate(e: PointerEvent): Point {
    const rect = canvas!.getBoundingClientRect();
    return point((e.clientX - rect.left) * SIZE / rect.width, (e.clientY - rect.top) * SIZE / rect.height);
  }

  function start(e: PointerEvent) {
    if (!canvas || pointer !== null || disabled || full || e.button !== 0) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    pointer = e.pointerId;
    overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    last = locate(e);
    count = pointCount(drawing) + 1;
    cleared = null;
    working = [...drawing, { c: colour, w: pen, p: [...last] }];
    onchange(working);
  }

  function move(e: PointerEvent) {
    if (pointer !== e.pointerId || disabled) return;
    const p = [...working.at(-1)!.p];
    const samples = e.getCoalescedEvents?.() ?? [];
    for (const sample of samples.length ? samples : [e]) {
      if (count >= MAX_POINTS) break;
      const next = locate(sample);
      if (!append(p, last, next)) continue;
      last = next;
      count++;
    }
    if (p.length === working.at(-1)!.p.length) return;
    working = [...working.slice(0, -1), { c: colour, w: pen, p }];
    onchange(working);
  }

  function unlock() {
    if (pointer === null) return;
    pointer = null;
    document.body.style.overflow = overflow;
  }

  function end(e: PointerEvent) {
    if (pointer !== e.pointerId) return;
    if (e.type === 'pointerup') move(e);
    unlock();
  }

  function undo() {
    if (!drawing.length && cleared) onchange(cleared);
    else onchange(drawing.slice(0, -1));
    cleared = null;
  }

  function clear() {
    cleared = drawing;
    onchange([]);
  }

  $effect(() => { if (disabled) unlock(); });
  onDestroy(unlock);
</script>

<canvas bind:this={canvas} bind:clientWidth={width} aria-label="Draw your fighter"
  onpointerdown={start} onpointermove={move} onpointerup={end} onpointercancel={end} onlostpointercapture={end}></canvas>
<div class="palette" aria-label="Ink colours">
  {#each PALETTE as name, i}
    <button type="button" aria-label={name} aria-pressed={i === colour} style:--swatch="var(--ink-{name})"
      onclick={() => (colour = i)}><span></span></button>
  {/each}
</div>
<div class="tools">
  {#each WIDTHS as w, i}
    <button type="button" aria-pressed={w === pen} onclick={() => (pen = w)}>{i === 0 ? 'Thin' : 'Thick'}</button>
  {/each}
  <button type="button" disabled={disabled || (!drawing.length && !cleared)} onclick={undo}>{!drawing.length && cleared ? 'Undo clear' : 'Undo'}</button>
  <button type="button" disabled={disabled || !drawing.length} onclick={clear}>Clear</button>
</div>
{#if full}<p role="status">Drawing limit reached. Undo a stroke to add more.</p>{/if}

<style>
  /* Small enough on a short phone that the name and Submit stay on screen. */
  canvas { width: min(100%, max(200px, 100dvh - var(--draw-chrome, 350px))); margin-inline: auto; aspect-ratio: 1; display: block; background: var(--ink-paper); border-radius: var(--r-md); touch-action: none; }
  .palette, .tools { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--s-1); }
  .palette { grid-template-columns: repeat(8, minmax(0, 1fr)); }
  button { min-height: 44px; min-width: 0; background: var(--surface); border-radius: var(--r-sm); border: 2px solid transparent; }
  button[aria-pressed='true'] { border-color: var(--accent); }
  .palette span { display: block; width: var(--s-5); height: var(--s-5); margin: auto; border-radius: 50%; background: var(--swatch); border: 1px solid var(--ink-paper); }
</style>
