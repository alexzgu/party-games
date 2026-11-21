<script lang="ts">
  // The two ends of the scale, sitting under the matching ends of the dial.
  import type { Spectrum } from '../../lib/content';
  let { card }: { card: Spectrum } = $props();
</script>

<div class="scale" aria-label="Scale from {card.left} to {card.right}">
  <div class="end left"><span class="arrow" aria-hidden="true">◀</span><span class="word">{card.left}</span></div>
  <div class="end right"><span class="word">{card.right}</span><span class="arrow" aria-hidden="true">▶</span></div>
</div>

<style>
  .scale { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-2); }
  .end {
    display: flex; align-items: center; gap: var(--s-2);
    min-height: 64px; padding: var(--s-2) var(--s-3);
    background: var(--surface); border-radius: var(--r-md);
    font-family: var(--font-display); font-weight: 800; font-size: clamp(1rem, 5vw, 1.3rem); line-height: 1.08; letter-spacing: -0.01em;
  }
  .right { justify-content: flex-end; text-align: right; }
  /* Words break between letters only when one alone is wider than its box. */
  .word { min-width: 0; overflow-wrap: break-word; hyphens: auto; }
  /* A phone on its side: the ends sit in half the width, so the words come down a size. */
  @media (orientation: landscape) and (max-height: 500px) { .end { min-height: 52px; font-size: clamp(0.95rem, 2.4vw, 1.2rem); padding: var(--s-2); } }
  .arrow { color: var(--accent); font-size: 0.8rem; flex: none; }
</style>
