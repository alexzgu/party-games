<script lang="ts">
  import type { Snippet } from 'svelte';
  import { back } from '../lib/router.svelte';

  // A standard page: header with back button, scrolling body, actions pinned above the home bar.
  let {
    title = '',
    accent,
    onback,
    backLabel = 'Back',
    hideBack = false,
    trailing,
    actions,
    children,
  }: {
    title?: string;
    accent?: string;
    /** Defaults to the page accent set by App for the current game. */
    onback?: () => void;
    backLabel?: string;
    hideBack?: boolean;
    trailing?: Snippet;
    actions?: Snippet;
    children: Snippet;
  } = $props();
</script>

<div class="screen fade-in" style:--accent={accent}>
  <header>
    {#if !hideBack}
      <button class="back" onclick={() => (onback ? onback() : back())} aria-label={backLabel}>
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    {/if}
    <h2 class="title">{title}</h2>
    <div class="trailing">{@render trailing?.()}</div>
  </header>
  <main class="body">{@render children()}</main>
  {#if actions}
    <footer class="actions">{@render actions()}</footer>
  {/if}
</div>

<style>
  .screen {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    padding: calc(var(--safe-top) + var(--s-3)) calc(var(--safe-right) + var(--s-4)) 0 calc(var(--safe-left) + var(--s-4));
    max-width: 640px;
    margin: 0 auto;
  }
  header {
    display: grid;
    grid-template-columns: 48px 1fr 48px;
    align-items: center;
    min-height: 52px;
    gap: var(--s-2);
  }
  .title { text-align: center; font-size: 1.35rem; color: var(--text); }
  .back {
    width: 48px; height: 48px; display: grid; place-items: center;
    background: var(--surface); border: 0; border-radius: var(--r-pill); color: var(--text);
    transition: transform var(--dur-fast) var(--ease-out);
  }
  .back:active { transform: scale(0.92); }
  .trailing { display: flex; justify-content: flex-end; }
  .body { flex: 1; padding: var(--s-4) 0 var(--s-5); display: flex; flex-direction: column; gap: var(--s-4); }
  .actions {
    position: sticky; bottom: 0;
    padding: var(--s-3) 0 calc(var(--safe-bottom) + var(--s-4));
    display: flex; flex-direction: column; gap: var(--s-2);
    background: linear-gradient(to top, var(--bg) 70%, transparent);
  }
</style>
