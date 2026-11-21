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
    split = false,
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
    /**
     * A phone on its side: the header across the top, the page's `.split-side` on the left at
     * full height and its `.split-main` on the right with the actions under it, so the page never
     * scrolls (a part too tall for its column scrolls inside it). The page flattens any wrapper
     * around them (`display: contents`). Upright both add no box, so the page looks as before.
     */
    split?: boolean;
    trailing?: Snippet;
    actions?: Snippet;
    children: Snippet;
  } = $props();
</script>

<div class="screen fade-in" class:split style:--accent={accent}>
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
  .screen :global(:is(.split-side, .split-main)) { display: contents; }
  @media (orientation: landscape) and (max-height: 500px) {
    .split {
      height: 100dvh; max-width: 960px; display: grid; column-gap: var(--s-5); row-gap: var(--s-2);
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto;
      grid-template-areas: 'head head' 'side main' 'side go';
      padding-bottom: calc(var(--safe-bottom) + var(--s-2));
    }
    .split header { grid-area: head; min-height: 48px; }
    .split .body { display: contents; }
    .split .actions { grid-area: go; position: static; padding: 0; background: none; }
    .split :global(:is(.split-side, .split-main)) {
      display: flex; flex-direction: column; gap: var(--s-3); min-height: 0; min-width: 0; overflow-y: auto;
    }
    .split :global(.split-side) { grid-area: side; }
    .split :global(.split-main) { grid-area: main; }
    /* Centred in the column while they fit; from the top (and scrolling) once they do not. */
    .split :global(:is(.split-side, .split-main) > :first-child) { margin-top: auto; }
    .split :global(:is(.split-side, .split-main) > :last-child) { margin-bottom: auto; }
  }
</style>
