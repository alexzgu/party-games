<script lang="ts">
  import type { Snippet } from 'svelte';
  import { back } from '../lib/router.svelte';
  import { padScroller } from '../lib/scrollPadding';

  // A standard page: header with back button pinned at the top, scrolling body, actions pinned
  // above the home bar. Both bars wear the page's background edge to edge. Children can pin
  // under the header with `top: var(--screen-head)` and reach the screen's edges with
  // `--gutter-l` / `--gutter-r` (the side padding, safe areas included).
  let {
    title = '',
    accent,
    onback,
    backLabel = 'Back',
    hideBack = false,
    split = false,
    fill = false,
    keep = 'screen',
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
    /**
     * The page fits the screen: the body takes the room between the header and the actions and
     * its own parts scroll (a pack page or a pack editor: only the list scrolls; components/PinnedPanel.svelte).
     * On a screen too short even for that the whole page scrolls, header and actions still pinned.
     */
    fill?: boolean;
    /** With `fill`, the screen's name for keeping its scroll across Back (lib/keepScroll.ts): a
     *  layer filling the screen over another page needs its own. */
    keep?: string;
    trailing?: Snippet;
    actions?: Snippet;
    children: Snippet;
  } = $props();

  // What the page scrolls to (a new row, a focused input) stops clear of the pinned bars. The
  // header's scroller is the page, or the screen itself when it fills the screen (again when that changes).
  let head: HTMLElement;
  let headH = $state(0);
  let footH = $state(0);
  $effect(() => {
    void fill;
    return padScroller(head, headH, footH);
  });
</script>

<div class="screen fade-in" class:split class:fill style:--accent={accent} data-keep-scroll={fill ? keep : undefined}>
  <header class="pinned-bg pinned-lift" bind:this={head} bind:offsetHeight={headH}>
    {#if !hideBack}
      <button class="back" onclick={() => (onback ? onback() : back())} aria-label={backLabel}>
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    {/if}
    <!-- One line, cut with "…" so the pinned header keeps its height; screen readers get it all. -->
    <h2 class="title" title={title}>{title}</h2>
    <div class="trailing">{@render trailing?.()}</div>
  </header>
  <main class="body">{@render children()}</main>
  {#if actions}
    <footer class="actions pinned-bg" bind:offsetHeight={footH}>{@render actions()}</footer>
  {/if}
</div>

<style>
  .screen {
    --gutter-l: calc(var(--safe-left) + var(--s-4));
    --gutter-r: calc(var(--safe-right) + var(--s-4));
    --head-pad: var(--s-3);
    --head-row: 52px;
    --screen-head: calc(var(--safe-top) + var(--head-pad) + var(--head-row));
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    padding: 0 var(--gutter-r) 0 var(--gutter-l);
    max-width: 640px;
    margin: 0 auto;
  }
  /* Pinned with a solid page background, under the status bar too. Bars inside the page sit
     under it; it rises above the start bar only while one of its own popups is open, and the
     start bar above it while the rules popup is open. */
  header {
    position: sticky; top: 0; z-index: var(--z-pinned);
    display: grid;
    grid-template-columns: 48px minmax(0, 1fr) 48px;
    align-items: center;
    height: var(--screen-head);
    gap: var(--s-2);
    margin: 0 calc(-1 * var(--gutter-r)) 0 calc(-1 * var(--gutter-l));
    padding: calc(var(--safe-top) + var(--head-pad)) var(--gutter-r) 0 var(--gutter-l);
  }
  header:has(:global(.scrim)), .actions:has(:global(.scrim)) { z-index: var(--z-raised); }
  .title { text-align: center; font-size: 1.35rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-block: 2px; }
  .back {
    width: 48px; height: 48px; display: grid; place-items: center;
    background: var(--surface); border: 0; border-radius: var(--r-pill); color: var(--text);
    transition: transform var(--dur-fast) var(--ease-out);
  }
  .back:active { transform: scale(0.92); }
  .trailing { display: flex; justify-content: flex-end; }
  .body { flex: 1; padding: var(--s-4) 0 var(--s-5); display: flex; flex-direction: column; gap: var(--s-4); }
  /* In the page's flow, so at the end of the page it sits under the content and covers none of it. */
  .actions {
    position: sticky; bottom: 0; z-index: var(--z-pinned); --pin-at: bottom;
    margin: 0 calc(-1 * var(--gutter-r)) 0 calc(-1 * var(--gutter-l));
    padding: var(--s-2) var(--gutter-r) calc(var(--safe-bottom) + var(--s-3)) var(--gutter-l);
    display: flex; flex-direction: column; gap: var(--s-2);
  }
  /* A short fade above it, over the body's bottom padding at the end of the page. */
  .actions::before {
    content: ''; position: absolute; left: 0; right: 0; bottom: 100%; height: var(--s-4); pointer-events: none;
    background: linear-gradient(to top, var(--bg), transparent);
  }
  /* The body takes what the header and actions leave, never less than its parts need (a pack
     page: its pinned top, a row of packs, its Add pack row); below that the screen scrolls. */
  .fill { height: 100dvh; min-height: 0; overflow: hidden auto; overscroll-behavior: contain; }
  .fill .body { flex: 1 1 0; padding-bottom: 0; }
  /* No actions under it: the body stops clear of the home bar. */
  .fill .body:last-child { padding-bottom: calc(var(--safe-bottom) + var(--s-2)); }
  .fill .actions::before { content: none; }
  .screen :global(:is(.split-side, .split-main)) { display: contents; }
  @media (orientation: landscape) and (max-height: 500px) {
    .screen { --head-pad: var(--s-2); --head-row: 48px; }
    /* A setup's rules row and start buttons side by side, so the pinned bars stay low. */
    .actions:has(> :global(.rules-card)) { flex-direction: row; align-items: stretch; }
    .actions:has(> :global(.rules-card)) > :global(*) { flex: 1 1 0; min-width: 0; }
    .fill .body { padding-top: var(--s-2); }
    .split {
      height: 100dvh; max-width: 960px; display: grid; column-gap: var(--s-5); row-gap: var(--s-2);
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto;
      grid-template-areas: 'head head' 'side main' 'side go';
      padding-top: calc(var(--safe-top) + var(--s-3)); padding-bottom: calc(var(--safe-bottom) + var(--s-2));
    }
    .split header { grid-area: head; position: static; height: auto; min-height: var(--tap-sm); margin: 0; padding: 0; background: none; animation: none; }
    .split .body { display: contents; }
    .split .actions { grid-area: go; position: static; margin: 0; padding: 0; background: none; }
    .split .actions::before { content: none; }
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
