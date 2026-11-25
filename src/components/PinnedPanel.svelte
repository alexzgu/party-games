<script lang="ts">
  import type { Snippet } from 'svelte';
  import { panelOpen, savePanelOpen, watchEdges, type PanelKind } from '../lib/panel';
  import { TAP_GUARD_MS, tapGuard } from '../lib/tapGuard';

  // A page body (in a Screen with `fill`) where only one part scrolls: pinned above it any
  // `notice`, then `top`, which folds away, then the `row` (a list's title and tools, which gets
  // the fold's toggle to place); pinned under it the `foot`. Hairlines mark the scroller's top and
  // bottom edges only while more is scrolled away that way. A pack page (PackList), every pack
  // editor and the Community lists are built on it.
  let {
    label,
    kind = 'setup',
    foldId,
    foldName,
    foldSpoken,
    foldNote = '',
    needed = false,
    keep,
    notice,
    top,
    row,
    foot,
    children,
  }: {
    /** The id of the heading that names the whole section. */
    label?: string;
    /** Which remembered fold choice this page shares: the setups', the pack editors' or Community's. */
    kind?: PanelKind;
    /** The fold's id, for its toggle's `aria-controls`. */
    foldId: string;
    /** The toggle's text, lowercase ("players", "details"); no toggle without it. */
    foldName?: string;
    /** What the toggle says it hides or shows, when not its text ("pack details"). */
    foldSpoken?: string;
    /** What the folded part still does, said in the toggle while folded ("filters on"). */
    foldNote?: string;
    /** The page needs `top` (too few players, the only way to add a first item): it shows, with no toggle. */
    needed?: boolean;
    /** The scroller's name for keeping its scroll across Back (lib/keepScroll.ts). */
    keep?: string;
    /** At the top of the panel, always shown. */
    notice?: Snippet;
    /** Folds away with the toggle. */
    top?: Snippet;
    /** Pinned over the scroller; render `toggle` in it (nothing when there is no toggle). */
    row: Snippet<[Snippet]>;
    /** Pinned under the scroller. */
    foot?: Snippet;
    /** What scrolls. */
    children: Snippet;
  } = $props();

  // The toggle sits where the last screen's buttons often were: a double tap there is ignored.
  const settled = tapGuard(TAP_GUARD_MS);

  let list: HTMLDivElement;
  let above = $state(false);
  let below = $state(false);
  $effect(() => watchEdges(list, (e) => { above = e.above; below = e.below; }));

  // Read once: a keyboard shrinking the screen never folds it. While the page needs it, it shows
  // (and stays shown once that is done, so adding the last player never folds it).
  // svelte-ignore state_referenced_locally
  let open = $state(panelOpen(needed, kind));
  $effect(() => { if (needed) open = true; });
  const canFold = $derived(!!top && !!foldName && !needed);
  function fold() {
    if (!settled()) return;
    open = !open;
    savePanelOpen(open, kind);
  }

  // A pack editor's details (a long add form) scroll on their own past about half the screen, so
  // the items keep their room; their edges fade where there is more. Not while they are needed:
  // there are no items yet, and the add form gets the room.
  const capped = $derived(kind === 'editor' && !needed);
  let pad = $state<HTMLDivElement>();
  let padAbove = $state(false);
  let padBelow = $state(false);
  $effect(() => {
    if (capped && pad) return watchEdges(pad, (e) => { padAbove = e.above; padBelow = e.below; });
  });

  // A screen that shrinks (a keyboard opening on some phones): the field being typed in stays in view.
  function keepFocus() {
    const el = document.activeElement;
    if (el instanceof HTMLElement && (list.contains(el) || pad?.contains(el))) el.scrollIntoView({ block: 'nearest' });
  }
</script>

<svelte:window onresize={keepFocus} />

{#snippet toggle()}
  {#if canFold}
    {@const note = open ? '' : foldNote}
    <button class="fold-toggle" class:open class:noted={!!note} aria-expanded={open} aria-controls={foldId} aria-label="{open ? 'Hide' : 'Show'} {foldSpoken ?? foldName}{note ? `, ${note}` : ''}" onclick={fold} data-tip="{open ? 'Hide' : 'Show'} {foldSpoken ?? foldName}">
      {#if note}<span class="fold-note">{note}</span>{:else}<span class="fold-name">{foldName}</span>{/if}
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 9.5l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  {/if}
{/snippet}

<section class="pinned" class:above class:below aria-labelledby={label}>
  <div class="panel">
    {@render notice?.()}
    {#if top}
      <div class="fold" class:open id={foldId} inert={!open}>
        <div class="fold-in">
          <div class="fold-pad" class:capped class:fade-top={padAbove} class:fade-bottom={padBelow} bind:this={pad}>{@render top()}</div>
        </div>
      </div>
    {/if}
    {@render row(toggle)}
  </div>

  <div class="listing" data-keep-scroll={keep} bind:this={list}>{@render children()}</div>

  {#if foot}<div class="foot">{@render foot()}</div>{:else}<div class="end" aria-hidden="true"></div>{/if}
</section>

<style>
  /* Fills the screen's body: the panel and the foot keep their height, the scroller takes the
     rest (at least about a row; less, and the whole screen scrolls). Each part runs edge to edge
     over the page's side padding, so a hairline or a cut spans the screen. */
  .pinned { flex: 1 1 0; display: flex; flex-direction: column; }
  .panel, .listing, .foot, .end {
    margin: 0 calc(-1 * var(--gutter-r, 0px)) 0 calc(-1 * var(--gutter-l, 0px));
    padding: 0 var(--gutter-r, 0px) 0 var(--gutter-l, 0px);
  }
  /* Over the scroller, so its hairline and shade fall on it; over the page's bars while a popup
     opened in it is up. */
  .panel { flex: none; display: flex; flex-direction: column; position: relative; z-index: 1; }
  .panel:has(:global(.scrim)) { z-index: var(--z-raised); }
  .listing {
    flex: 1 1 0; min-height: 96px; overflow-y: auto;
    padding-block: 4px var(--s-2); scroll-padding-block: var(--s-2);
  }
  /* Positioned after the scroller, so its hairline falls on it. */
  .foot { flex: none; position: relative; }
  .above .panel { box-shadow: 0 1px 0 var(--line), 0 10px 18px -16px var(--shade); }
  .below .foot { box-shadow: 0 -1px 0 var(--line), 0 -10px 18px -16px var(--shade); }
  /* No foot (the page's actions come next): the same hairline and shade, drawn over the
     scroller's last pixels so nothing hangs below the page. */
  .end { flex: none; height: 0; position: relative; }
  .below .end::before {
    content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 16px; pointer-events: none;
    border-bottom: 1px solid var(--line);
    background: linear-gradient(to top, color-mix(in srgb, var(--shade) 25%, transparent), color-mix(in srgb, var(--shade) 9%, transparent) 6px,
      color-mix(in srgb, var(--shade) 2%, transparent) 12px, transparent);
  }

  /* Folds away to nothing and back (`inert` while folded). */
  .fold {
    display: grid; grid-template-rows: 0fr;
    transition: grid-template-rows var(--dur) var(--ease-out);
    margin: 0 calc(-1 * var(--gutter-r, 0px)) 0 calc(-1 * var(--gutter-l, 0px));
  }
  .fold.open { grid-template-rows: 1fr; }
  .fold-in { min-height: 0; overflow: hidden; }
  .fold-pad { display: flex; flex-direction: column; gap: var(--s-4); padding: 4px var(--gutter-r, 0px) var(--s-4) var(--gutter-l, 0px); }
  .fold:not(.open) .fold-in { visibility: hidden; transition: visibility 0s var(--dur); }
  .capped {
    --fade: 28px; max-height: 45dvh; overflow-y: auto; overscroll-behavior: contain; scroll-padding-block: var(--fade);
  }
  .fade-top, .fade-bottom {
    --top: 0px; --bottom: 0px;
    -webkit-mask-image: linear-gradient(to bottom, transparent, #000 var(--top), #000 calc(100% - var(--bottom)), transparent);
    mask-image: linear-gradient(to bottom, transparent, #000 var(--top), #000 calc(100% - var(--bottom)), transparent);
  }
  .fade-top { --top: var(--fade); }
  .fade-bottom { --bottom: var(--fade); }
  .fold-toggle {
    flex: none; height: var(--tap-min); min-width: var(--tap-min); display: flex; align-items: center; gap: 2px;
    padding: 0 6px 0 var(--s-3); border: 0; border-radius: var(--r-pill);
    background: var(--overlay); color: var(--text-dim); font-weight: 700; font-size: 0.85rem;
  }
  .fold-toggle:active { background: var(--overlay-strong); }
  .fold-name::first-letter, .fold-note::first-letter { text-transform: uppercase; }
  /* Folded while it still narrows what is shown: said in the accent, so a short list is no mystery. */
  .fold-toggle.noted { color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .fold-toggle svg { transition: transform var(--dur) var(--ease-out); }
  .fold-toggle.open svg { transform: rotate(180deg); }
  /* A narrow phone: the arrow alone, so the row's title keeps its room. */
  @media (max-width: 359.98px) {
    .fold-name { display: none; }
    .fold-toggle { padding: 0; justify-content: center; }
    .fold-toggle.noted { padding: 0 6px 0 var(--s-3); }
  }
  /* A phone on its side: half a tile is enough before the whole screen scrolls. */
  @media (orientation: landscape) and (max-height: 500px) {
    .listing { min-height: var(--tap-lg); }
  }
  @media (prefers-reduced-motion: reduce) {
    .fold, .fold-toggle svg { transition: none; }
    .fold:not(.open) .fold-in { transition: none; }
  }
</style>
