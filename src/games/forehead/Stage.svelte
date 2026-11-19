<script lang="ts">
  import type { Snippet } from 'svelte';

  // A full-screen layer turned by `rotation` degrees, sized so that a quarter turn swaps width
  // and height: the play screen fills the phone however the page itself is oriented.
  let { rotation = 0, children }: { rotation?: number; children: Snippet } = $props();

  let w = $state(innerWidth);
  let h = $state(innerHeight);
  const quarter = $derived(Math.abs(rotation) === 90);

  $effect(() => {
    const size = () => { w = innerWidth; h = innerHeight; };
    addEventListener('resize', size);
    addEventListener('orientationchange', size);
    return () => { removeEventListener('resize', size); removeEventListener('orientationchange', size); };
  });
</script>

<div
  class="stage"
  style:width="{quarter ? h : w}px"
  style:height="{quarter ? w : h}px"
  style:transform="translate(-50%, -50%) rotate({rotation}deg)"
>
  {@render children()}
</div>

<style>
  .stage {
    position: fixed; left: 50%; top: 50%; overflow: hidden;
    /* Notches and home bars can end up on any side once the content is turned. */
    --edge: max(16px, var(--safe-top), var(--safe-bottom), var(--safe-left), var(--safe-right));
  }
</style>
