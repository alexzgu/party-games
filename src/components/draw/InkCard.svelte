<script lang="ts">
  import { paint, type Drawing } from '../../lib/ink';
  let { drawing, label = 'Fighter drawing', empty = 'Awaiting drawing' }: { drawing?: Drawing; label?: string; empty?: string } = $props();
  let canvas = $state<HTMLCanvasElement>();
  let width = $state(0);
  $effect(() => {
    if (canvas && width && drawing) paint(canvas, drawing, Math.round(width * devicePixelRatio));
  });
</script>

{#if drawing}
  <canvas bind:this={canvas} bind:clientWidth={width} aria-label={label}></canvas>
{:else}
  <div class="empty">{empty}</div>
{/if}

<style>
  canvas, .empty { display: block; width: 100%; aspect-ratio: 1; border-radius: var(--r-md); background: var(--ink-paper); }
  .empty { display: grid; place-items: center; color: var(--ink-black); text-align: center; padding: var(--s-2); }
</style>
