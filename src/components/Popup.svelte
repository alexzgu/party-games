<script lang="ts">
  import type { Snippet } from 'svelte';
  import { controls, wrapTo } from '../lib/focusRing';

  // A sheet over the whole page (how to play, details). Tap outside, ✕ or Escape closes it, and
  // focus goes back to whatever opened it; until then Tab stays inside. `footer` stays pinned under the scrolling body; `wide`
  // lets a phone on its side use more of its width.
  let { title, onclose, children, footer, wide = false }: { title: string; onclose: () => void; children: Snippet; footer?: Snippet; wide?: boolean } = $props();

  let card: HTMLDivElement;
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  $effect(() => {
    card.querySelector<HTMLElement>('.x')?.focus({ focusVisible: false } as FocusOptions);
    return () => opener?.isConnected && opener.focus({ preventScroll: true });
  });

  function tab(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const at = document.activeElement;
    const to = wrapTo(controls(card), at === card ? null : (at as HTMLElement | null), e.shiftKey);
    if (!to) return;
    e.preventDefault();
    to.focus();
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="scrim fade-in" role="presentation" onclick={(e) => e.target === e.currentTarget && onclose()}>
  <div class="card pop-in" class:wide role="dialog" aria-modal="true" aria-label={title} tabindex="-1" onkeydown={tab} bind:this={card}>
    <header>
      <h2>{title}</h2>
      <button class="x" aria-label="Close" onclick={onclose}>✕</button>
    </header>
    <div class="body">{@render children()}</div>
    {#if footer}<footer>{@render footer()}</footer>{/if}
  </div>
</div>

<style>
  .scrim {
    position: fixed; inset: 0; z-index: var(--z-popup); display: grid; place-items: center;
    padding: max(var(--s-4), env(safe-area-inset-top)) var(--s-4) max(var(--s-4), env(safe-area-inset-bottom));
    background: var(--scrim); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  }
  .card {
    width: min(460px, 100%); max-height: 100%; display: flex; flex-direction: column;
    background: var(--bg-raised); border: 1.5px solid var(--line-strong); border-radius: var(--r-lg);
    box-shadow: var(--shadow); overflow: hidden; outline: none;
  }
  header { display: flex; align-items: center; gap: var(--s-3); padding: var(--s-4) var(--s-4) var(--s-2) var(--s-5); }
  h2 { flex: 1; margin: 0; }
  .x {
    width: 44px; height: 44px; border: 0; border-radius: 50%; display: grid; place-items: center; font-size: 1.1rem;
    background: var(--overlay); color: var(--text);
  }
  .body { overflow-y: auto; padding: var(--s-2) var(--s-5) var(--s-5); }
  footer { flex: none; display: flex; flex-direction: column; padding: var(--s-3) var(--s-5) var(--s-4); border-top: 1px solid var(--line); }
  @media (orientation: landscape) and (max-height: 500px) {
    .wide { width: min(760px, 100%); }
    header { padding: var(--s-3) var(--s-3) var(--s-1) var(--s-5); }
    footer { padding: var(--s-2) var(--s-5) var(--s-3); }
  }
</style>
