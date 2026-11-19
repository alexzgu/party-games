<script lang="ts">
  import type { Snippet } from 'svelte';

  // The slim header over the board and the clue: back on the left, a title, tools on the right.
  let { backLabel, onback, title, tools }: { backLabel: string; onback: () => void; title: Snippet; tools?: Snippet } = $props();
</script>

<header class="bar">
  <button class="round" onclick={onback} aria-label={backLabel}>
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>
  <div class="title">{@render title()}</div>
  <div class="tools">{@render tools?.()}</div>
</header>

<style>
  .bar { display: flex; align-items: center; gap: var(--s-2); min-height: 52px; }
  .round {
    flex: none; width: 48px; height: 48px; display: grid; place-items: center;
    background: var(--surface); border: 0; border-radius: var(--r-pill); color: var(--text);
  }
  .round:active { transform: scale(0.92); }
  .title { flex: 1; min-width: 0; }
  .tools { flex: none; display: flex; align-items: center; gap: var(--s-1); }
  .tools :global(.tool) {
    min-width: 44px; height: 44px; padding: 0 12px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    border: 0; border-radius: var(--r-pill); background: var(--surface); color: var(--text-dim); font-weight: 700; font-size: 0.95rem;
  }
  .tools :global(.tool:disabled) { opacity: 0.35; }
  .tools :global(.tool:active:not(:disabled)) { background: var(--surface-hi); }
</style>
