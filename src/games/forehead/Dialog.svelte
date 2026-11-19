<script lang="ts">
  import type { Snippet } from 'svelte';

  // A modal card over the play screen (pause, end round). Taps on it never reach the game.
  let { title, text = '', children }: { title: string; text?: string; children: Snippet } = $props();

  let card: HTMLDivElement;
  // Focus the first action on open so keyboards and screen readers land inside the dialog.
  $effect(() => card.querySelector('button')?.focus({ focusVisible: false } as FocusOptions));
</script>

<div class="scrim fade-in" role="dialog" tabindex="-1" aria-modal="true" aria-label={title} onpointerdown={(e) => e.stopPropagation()}>
  <div class="card pop-in" bind:this={card}>
    <h2>{title}</h2>
    {#if text}<p class="muted">{text}</p>{/if}
    <div class="actions">{@render children()}</div>
  </div>
</div>

<style>
  .scrim {
    position: absolute; inset: 0; z-index: 20; display: grid; place-items: center; padding: var(--edge, 16px);
    background: var(--scrim); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  }
  .card {
    width: min(420px, 100%); background: var(--bg-raised); border: 1.5px solid var(--line-strong);
    border-radius: var(--r-lg); padding: var(--s-5); display: flex; flex-direction: column; gap: var(--s-3);
    box-shadow: var(--shadow); text-align: center;
  }
  .actions { display: flex; flex-direction: column; gap: var(--s-2); margin-top: var(--s-2); }
</style>
