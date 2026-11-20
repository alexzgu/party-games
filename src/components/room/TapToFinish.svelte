<script lang="ts">
  import type { Snippet } from 'svelte';

  // Wraps a screen whose animations the room waits through (answer reveal, points, confetti,
  // entrances): any tap jumps every one of them to its end state. The game state is saved before
  // they start, so finishing early never changes a score. A tap on something still less than
  // half faded in only skips: its click is swallowed so it never presses a half-seen button.
  let { children }: { children: Snippet } = $props();
  let root: HTMLDivElement;
  let swallow = false;
  // CSS animations only: a button's own press transition is not something to skip.
  const finite = (a: Animation) => 'animationName' in a && a.playState === 'running' && a.effect?.getComputedTiming().endTime !== Infinity;

  function finish(e: PointerEvent) {
    const running = root.getAnimations({ subtree: true }).filter(finite);
    const hit = e.target as Node;
    swallow = running.some((a) => {
      const el = (a.effect as KeyframeEffect | null)?.target;
      return !!el && el.contains(hit) && (a.effect?.getComputedTiming().progress ?? 1) < 0.5;
    });
    for (const a of running) {
      try { a.finish(); } catch { /* cannot finish; leave it running */ }
    }
  }

  function click(e: MouseEvent) {
    if (!swallow) return;
    swallow = false;
    e.preventDefault();
    e.stopPropagation();
  }
</script>

<svelte:window onpointerdowncapture={finish} onclickcapture={click} />

<div class="finish" bind:this={root}>{@render children()}</div>

<style>
  .finish { display: contents; }
</style>
