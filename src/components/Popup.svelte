<script lang="ts">
  import type { Snippet } from 'svelte';

  // A sheet over the whole page (how to play, details). Tap outside, ✕ or Escape closes it.
  let { title, onclose, children }: { title: string; onclose: () => void; children: Snippet } = $props();

  let card: HTMLDivElement;
  $effect(() => card.querySelector<HTMLElement>('.x')?.focus({ focusVisible: false } as FocusOptions));
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<div class="scrim fade-in" role="presentation" onclick={(e) => e.target === e.currentTarget && onclose()}>
  <div class="card pop-in" role="dialog" aria-modal="true" aria-label={title} bind:this={card}>
    <header>
      <h2>{title}</h2>
      <button class="x" aria-label="Close" onclick={onclose}>✕</button>
    </header>
    <div class="body">{@render children()}</div>
  </div>
</div>

<style>
  .scrim {
    position: fixed; inset: 0; z-index: 50; display: grid; place-items: center;
    padding: max(var(--s-4), env(safe-area-inset-top)) var(--s-4) max(var(--s-4), env(safe-area-inset-bottom));
    background: rgb(8 5 18 / 0.82); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  }
  .card {
    width: min(460px, 100%); max-height: 100%; display: flex; flex-direction: column;
    background: var(--bg-raised); border: 1.5px solid var(--line-strong); border-radius: var(--r-lg);
    box-shadow: var(--shadow); overflow: hidden;
  }
  header { display: flex; align-items: center; gap: var(--s-3); padding: var(--s-4) var(--s-4) var(--s-2) var(--s-5); }
  h2 { flex: 1; margin: 0; }
  .x {
    width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; font-size: 1.1rem;
    background: rgb(255 255 255 / 0.08); color: var(--text);
  }
  .body { overflow-y: auto; padding: var(--s-2) var(--s-5) var(--s-5); }
</style>
