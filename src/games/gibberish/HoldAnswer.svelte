<script lang="ts">
  import { haptic } from '../../lib/haptics';

  // Press and hold to peek at the answer; let go and it hides. Pointer capture keeps the peek
  // steady if the thumb slides, and the CSS stops iPhone's text selection and callout menu.
  let { answer, peek = $bindable(false) }: { answer: string; peek?: boolean } = $props();

  function down(e: PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    peek = true;
    haptic.light();
  }
  const up = () => (peek = false);
  function key(e: KeyboardEvent, on: boolean) {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    peek = on;
  }
</script>

<button
  class="hold"
  class:on={peek}
  aria-label={peek ? `Answer: ${answer}` : 'Hold to see the answer'}
  onpointerdown={down}
  onpointerup={up}
  onpointercancel={up}
  onlostpointercapture={up}
  oncontextmenu={(e) => e.preventDefault()}
  onkeydown={(e) => key(e, true)}
  onkeyup={(e) => key(e, false)}
  onblur={up}
>
  {#if peek}
    <span class="ans">{answer}</span>
  {:else}
    <span class="icon" aria-hidden="true">👆</span><span>Hold for answer</span>
  {/if}
</button>

<style>
  .hold {
    width: 100%; min-height: var(--tap-lg); padding: var(--s-2) var(--s-3); border-radius: var(--r-md);
    border: 1.5px dashed var(--line-strong); background: var(--bg-sunk); color: var(--text-dim);
    display: flex; align-items: center; justify-content: center; gap: var(--s-2); font-weight: 700;
    -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; touch-action: none;
    transition: background var(--dur-fast) ease, border-color var(--dur-fast) ease;
  }
  .hold.on { border-style: solid; border-color: var(--c-gold); background: color-mix(in srgb, var(--c-gold) 16%, var(--bg-sunk)); }
  .ans { color: var(--c-gold); font-family: var(--font-display); font-weight: 800; font-size: 1.15rem; line-height: 1.1; text-align: center; }
  .icon { font-size: 1.2rem; }
  span { pointer-events: none; }
</style>
