<script lang="ts">
  // Phone: while the host is asked whether this phone may have its seat, the number to compare with
  // the one on the host screen. Its own panel, filled only by this phone's own sum: whatever text a
  // host sends is shown elsewhere.
  let { number }: { number: string } = $props();
</script>

{#if number}
  <div class="seat-number pop-in" role="status">
    <p>The host screen should ask about the phone showing</p>
    <output>{number}</output>
  </div>
{/if}

<style>
  .seat-number {
    position: fixed; z-index: var(--z-raised); left: 50%; translate: -50% 0;
    /* Above a bottom button, below the join form's. */
    bottom: calc(84px + env(safe-area-inset-bottom)); width: min(360px, calc(100% - 2 * var(--s-4)));
    display: grid; justify-items: center; gap: var(--s-2); padding: var(--s-4); text-align: center;
    background: var(--bg-raised); border: 2px solid var(--accent); border-radius: var(--r-lg); box-shadow: var(--shadow);
  }
  p { margin: 0; font-weight: 700; }
  output { font-family: var(--font-display); font-weight: 800; font-size: 2.6rem; line-height: 1; font-variant-numeric: tabular-nums; }
</style>
