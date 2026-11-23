<script lang="ts">
  import { tick } from 'svelte';
  import { placeTip, tipText } from '../lib/tooltip';

  // One tooltip for the whole app (App.svelte): hovering a button with a mouse or pen, or reaching
  // it with the keyboard, shows what it does (`data-tip`; a picture-only button shows its spoken
  // name). Never for touch: a tap acts at once. It never takes taps, and goes on any press, Escape,
  // scroll or when its button goes.
  const WAIT_MS = 450;
  let text = $state('');
  let at = $state<{ left: number; top: number } | null>(null);
  let el: HTMLDivElement | undefined = $state();
  let target: HTMLElement | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const buttonOf = (e: Event): HTMLElement | null =>
    e.target instanceof Element ? e.target.closest<HTMLElement>('[data-tip], button, a[aria-label], [role="button"]') : null;

  function hide() {
    clearTimeout(timer);
    if (target?.getAttribute('aria-describedby') === 'tooltip') target.removeAttribute('aria-describedby');
    target = null;
    text = '';
    at = null;
  }

  async function show(b: HTMLElement) {
    const say = tipText({ tip: b.dataset.tip, label: b.getAttribute('aria-label'), shown: b.textContent ?? '' });
    if (!say || !b.isConnected) return;
    text = say;
    await tick();
    if (!el || target !== b) return;
    at = placeTip(b.getBoundingClientRect(), { width: el.offsetWidth, height: el.offsetHeight }, { width: innerWidth, height: innerHeight });
    if (b.dataset.tip && !b.hasAttribute('aria-describedby')) b.setAttribute('aria-describedby', 'tooltip');
  }

  function aim(b: HTMLElement | null, wait: number) {
    if (b === target) return;
    hide();
    if (!b) return;
    target = b;
    timer = setTimeout(() => void show(b), wait);
  }

  // A button that goes away (a page or popup closing) takes its tip along.
  $effect(() => {
    if (!text) return;
    const seen = new MutationObserver(() => { if (target && !target.isConnected) hide(); });
    seen.observe(document.body, { childList: true, subtree: true });
    return () => seen.disconnect();
  });
</script>

<svelte:window
  onpointerover={(e) => { if (e.pointerType !== 'touch') aim(buttonOf(e), WAIT_MS); }}
  onpointerdown={hide}
  onpointerout={(e) => { if (!e.relatedTarget) hide(); }}
  onfocusin={(e) => { const b = buttonOf(e); if (b?.matches(':focus-visible')) aim(b, WAIT_MS); }}
  onfocusout={hide}
  onkeydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') hide(); }}
  onscrollcapture={hide}
  onblur={hide}
/>

{#if text}
  <div id="tooltip" role="tooltip" bind:this={el} style:left="{at?.left ?? 0}px" style:top="{at?.top ?? 0}px" class:on={at}>{text}</div>
{/if}

<style>
  div {
    position: fixed; z-index: var(--z-toast); pointer-events: none; visibility: hidden;
    max-width: min(280px, calc(100vw - 16px)); width: max-content; padding: var(--s-2) var(--s-3);
    border-radius: 10px; background: var(--text); color: var(--bg); font-size: 0.9rem; line-height: 1.3; font-weight: 600;
    box-shadow: 0 6px 20px rgb(0 0 0 / 0.3);
  }
  div.on { visibility: visible; }
</style>
