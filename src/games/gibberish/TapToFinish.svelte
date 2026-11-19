<script lang="ts">
  import type { Snippet } from 'svelte';

  // Wraps a screen whose animations the room waits through (answer reveal, +1, confetti,
  // entrances): any tap jumps every one of them to its end state. The game state is already
  // saved before they start, so finishing early never changes a score. Never wrap the card
  // screen: its timer is not an animation and must not be skipped.
  let { children }: { children: Snippet } = $props();
  let root: HTMLDivElement;

  // A tap on something still less than half faded in is only a skip: its click is swallowed,
  // so it never presses a button the player could barely see (same rule as Heads Down.).
  let swallow = false;
  // CSS animations only: a button's own hover or press transition is not something to skip.
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
