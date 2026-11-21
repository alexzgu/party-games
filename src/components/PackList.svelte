<script lang="ts">
  import type { PackGameId } from '../app.config';
  import ListTools from './ListTools.svelte';
  import PackFile from './PackFile.svelte';
  import { afterImport, findEntries, pickedLine, tapped, type PackEntry } from '../lib/packList';
  import type { SortKey } from '../lib/listing';
  import { panelOpen, savePanelOpen, watchEdges } from '../lib/panel';
  import { settings, saveSettings } from '../lib/settings.svelte';
  import { sfx } from '../lib/sound';
  import { haptic } from '../lib/haptics';
  import { TAP_GUARD_MS, tapGuard } from '../lib/tapGuard';
  import type { Snippet } from 'svelte';

  // Every pack game's pack page body (in a Screen with `fill`). Tapping a pack ticks it (Big Board:
  // picks it); its pencil opens it to see and edit; "Make a pack" comes last. Tiles or rows, one
  // choice for every game (Settings has it too). Search and sort only change what is shown: picks
  // on hidden packs stay and still count. Only the packs scroll: above them stay the game's `top`
  // (players or teams), which the packs row can hide, and the packs row; under them the Add pack
  // row (New, Community, Import; Export), just over the start bar.
  let {
    game,
    entries,
    selected = $bindable(),
    single = false,
    title: heading = 'Packs',
    noun,
    placeholder,
    makeHint,
    top,
    topName,
    topNeeded = false,
    notice,
    keepOnImport = false,
    guard = 0,
    onedit,
    onmake,
    onimported,
  }: {
    game: PackGameId;
    /** Every pack, in the suggested order. */
    entries: PackEntry[];
    selected: string[];
    /** Big Board: exactly one pack, picked with a round mark. */
    single?: boolean;
    title?: string;
    /** What a pack holds, plural ("words"), for the header's total. */
    noun: string;
    placeholder: string;
    /** Under "Make a pack": the ways there ("Paste a list or ask the wizard"). */
    makeHint: string;
    /** Above the packs row, pinned: players or teams. The packs row can hide it (one choice for every game). */
    top?: Snippet;
    /** What `top` holds, plural and lowercase, for its toggle ("players"). */
    topName?: string;
    /** The game cannot start without changes in `top` (too few players): it shows, with no toggle. */
    topNeeded?: boolean;
    /** At the top of the panel, always shown (a game in progress, a note about the pick). */
    notice?: Snippet;
    /** Snark Tank: imported packs join the picked ones instead of replacing them. */
    keepOnImport?: boolean;
    /** Taps in the first `guard` ms are the tail of a double tap on the screen before (Brain Freeze). */
    guard?: number;
    onedit: (id: string) => void;
    /** "Make a pack" and Add pack → New: the game's way to make a pack. */
    onmake: () => void;
    /** After an import: the parent reloads `entries`. */
    onimported: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  const ready = tapGuard(guard);
  // The packs row's own buttons sit where the last screen's often were: a double tap there is ignored.
  const settled = tapGuard(TAP_GUARD_MS);

  let query = $state('');
  let sort = $state<SortKey>('suggested');
  const shown = $derived(findEntries(entries, query, sort));
  const searching = $derived(!!query.trim());
  const rows = $derived(settings.packView === 'rows');
  const headId = $derived(`${game}-packs-h`);

  function tap(id: string) {
    if (!ready()) return;
    selected = tapped(selected, id, single);
    sfx.tap();
    haptic.light();
  }

  function imported(ids: string[]) {
    selected = afterImport(selected, ids, single, keepOnImport);
    onimported();
  }

  // Hairlines over and under the packs only where some are scrolled out of sight that way.
  let list: HTMLDivElement;
  let above = $state(false);
  let below = $state(false);
  $effect(() => watchEdges(list, (e) => { above = e.above; below = e.below; }));

  // Read once: a keyboard shrinking the screen never folds it. While the game needs changes
  // there it shows (and stays shown once they are made, so adding the last player never folds it).
  // svelte-ignore state_referenced_locally
  let open = $state(panelOpen(topNeeded));
  $effect(() => { if (topNeeded) open = true; });
  const topId = $derived(`${game}-top`);
  function fold() {
    if (!settled()) return;
    open = !open;
    savePanelOpen(open);
  }

  function switchView() {
    if (!settled()) return;
    settings.packView = rows ? 'tiles' : 'rows';
    saveSettings();
  }
</script>

{#snippet pencil()}
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg>
{/snippet}

<section class="packlist" class:rows class:above class:below aria-labelledby={headId}>
  <div class="panel">
    {@render notice?.()}
    {#if top}
      <div class="fold" class:open id={topId} inert={!open}>
        <div class="fold-in"><div class="fold-pad">{@render top()}</div></div>
      </div>
    {/if}
    <ListTools key="{game}:packs" bind:query bind:sort {placeholder} shown={shown.length} total={entries.length}>
      {#snippet title()}
        <div class="head">
          <h3 id={headId}>{heading}</h3>
          <span class="picked">{pickedLine(entries, selected, noun, single)}</span>
        </div>
      {/snippet}
      {#snippet extra()}
        <button class="view" aria-label={rows ? 'Show packs as tiles' : 'Show packs as a list'} onclick={switchView}>
          {#if rows}
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/></g></svg>
          {:else}
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
          {/if}
        </button>
        {#if top && topName && !topNeeded}
          <button class="fold-toggle" class:open aria-expanded={open} aria-controls={topId} aria-label="{open ? 'Hide' : 'Show'} {topName}" onclick={fold}>
            <span class="fold-name">{topName}</span>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 9.5l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        {/if}
      {/snippet}
    </ListTools>
  </div>

  <div class="listing" data-keep-scroll="packs" bind:this={list}>
    {#if searching && !shown.length}<p class="none">No packs match “{query.trim()}”</p>{/if}
    <ul class="items" role={single ? 'radiogroup' : 'list'} aria-labelledby={headId}>
      {#each shown as { entry: e, hit } (e.id)}
        {@const on = selected.includes(e.id)}
        <li class="item">
          <button class="pack" class:on role={single ? 'radio' : undefined} aria-checked={single ? on : undefined} aria-pressed={single ? undefined : on} onclick={() => tap(e.id)}>
            <span class="mark" class:round={single} aria-hidden="true">
              {#if single}<span class="dot"></span>{:else}<svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>{/if}
            </span>
            {#if e.icon}<span class="icon" aria-hidden="true">{e.icon}</span>{/if}
            <span class="txt">
              <span class="name">{e.name}{#if rows && e.tag}<span class="tag">{e.tag}</span>{/if}</span>
              {#if e.blurb}<span class="blurb">{e.blurb}</span>{/if}
              {#if rows && e.details}<span class="details">{e.details}</span>{/if}
              {#if hit}<span class="hit">{hit}</span>{/if}
              <span class="meta">{e.sizeLabel}{#if !rows && e.tag}{` · ${e.tag}`}{/if}{#if e.warn}<span class="warn">{` · ${e.warn}`}</span>{/if}</span>
            </span>
          </button>
          <button class="edit" onclick={() => ready() && onedit(e.id)} aria-label="See and edit {e.name}">{@render pencil()}</button>
        </li>
      {/each}
      {#if !searching}
        <li class="item">
          <button class="pack make" onclick={() => ready() && onmake()}>
            <span class="mark spark" aria-hidden="true">✨</span>
            <span class="txt">
              <span class="name">Make a pack</span>
              <span class="blurb">{makeHint}</span>
            </span>
          </button>
        </li>
      {/if}
    </ul>
  </div>

  <div class="foot"><PackFile {game} {onmake} onimported={imported} /></div>
</section>

<style>
  /* Fills the screen's body: the panel and the Add pack row keep their height, the packs take the
     rest (at least a row of them; less, and the whole screen scrolls) and scroll. Each part runs
     edge to edge over the page's side padding, so a hairline or a cut spans the screen. */
  .packlist { flex: 1 1 0; display: flex; flex-direction: column; }
  .panel, .listing, .foot {
    margin: 0 calc(-1 * var(--gutter-r, 0px)) 0 calc(-1 * var(--gutter-l, 0px));
    padding: 0 var(--gutter-r, 0px) 0 var(--gutter-l, 0px);
  }
  /* Over the packs, so its hairline and shade fall on them; over the page's bars while a popup
     opened in it is up. */
  .panel { flex: none; display: flex; flex-direction: column; position: relative; z-index: 1; }
  .panel:has(:global(.scrim)) { z-index: var(--z-raised); }
  .listing {
    flex: 1 1 0; min-height: 96px; overflow-y: auto;
    padding-block: 4px var(--s-2); scroll-padding-block: var(--s-2);
  }
  /* Positioned after the packs, so its hairline falls on them. */
  .foot { flex: none; position: relative; }
  .above .panel { box-shadow: 0 1px 0 var(--line), 0 10px 18px -16px var(--shade); }
  .below .foot { box-shadow: 0 -1px 0 var(--line), 0 -10px 18px -16px var(--shade); }

  /* Players or teams: folds away to nothing and back (`inert` while folded). */
  .fold {
    display: grid; grid-template-rows: 0fr;
    transition: grid-template-rows var(--dur) var(--ease-out);
    margin: 0 calc(-1 * var(--gutter-r, 0px)) 0 calc(-1 * var(--gutter-l, 0px));
  }
  .fold.open { grid-template-rows: 1fr; }
  .fold-in { min-height: 0; overflow: hidden; }
  .fold-pad { display: flex; flex-direction: column; gap: var(--s-4); padding: 4px var(--gutter-r, 0px) var(--s-4) var(--gutter-l, 0px); }
  .fold:not(.open) .fold-in { visibility: hidden; transition: visibility 0s var(--dur); }
  .fold-toggle {
    flex: none; height: var(--tap-min); min-width: var(--tap-min); display: flex; align-items: center; gap: 2px;
    padding: 0 6px 0 var(--s-3); border: 0; border-radius: var(--r-pill);
    background: var(--overlay); color: var(--text-dim); font-weight: 700; font-size: 0.85rem;
  }
  .fold-toggle:active { background: var(--overlay-strong); }
  .fold-name::first-letter { text-transform: uppercase; }
  .fold-toggle svg { transition: transform var(--dur) var(--ease-out); }
  .fold-toggle.open svg { transform: rotate(180deg); }
  /* A narrow phone: the arrow alone, so the packs' title keeps its room. */
  @media (max-width: 359.98px) {
    .fold-name { display: none; }
    .fold-toggle { padding: 0; justify-content: center; }
  }
  .head { display: flex; flex-direction: column; min-width: 0; }
  .picked { color: var(--text-faint); font-size: 0.85rem; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .view {
    flex: none; width: var(--tap-min); height: var(--tap-min); border: 0; border-radius: var(--r-pill); display: grid; place-items: center;
    color: var(--text-faint); background: transparent;
  }
  .view:active { background: var(--overlay); }
  .none { margin: 0 0 var(--s-3); color: var(--text-dim); text-align: center; }

  .items { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--s-2); }
  .rows .items { grid-template-columns: minmax(0, 1fr); }
  .item { position: relative; min-width: 0; }
  .pack {
    width: 100%; height: 100%; min-height: 120px; text-align: left; color: var(--text);
    padding: var(--s-3); border-radius: var(--r-md); border: 2px solid var(--line); background: var(--surface);
    display: flex; flex-direction: column;
    transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast) ease, background var(--dur-fast) ease;
  }
  .pack:active { transform: scale(0.97); }
  .pack.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 18%, var(--surface)); }
  .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .icon { font-size: 1.7rem; line-height: 1.1; margin-bottom: var(--s-1); }
  .name { font-family: var(--font-display); font-weight: 800; font-size: 1.12rem; line-height: 1.15; letter-spacing: -0.01em; padding-right: 30px; overflow-wrap: anywhere; }
  .blurb { color: var(--text-dim); font-size: 0.86rem; line-height: 1.28; }
  .hit { color: var(--text-faint); font-size: 0.8rem; font-style: italic; line-height: 1.25; overflow-wrap: anywhere; }
  .meta { margin-top: auto; padding: var(--s-1) 40px 0 0; min-height: 30px; display: flex; align-items: flex-end; flex-wrap: wrap; color: var(--text-faint); font-size: 0.8rem; font-weight: 700; font-variant-numeric: tabular-nums; }
  .warn { color: var(--c-pass); white-space: pre; }

  /* The tick (several packs) is a rounded square; the single pick (Big Board) is round. */
  .mark {
    position: absolute; top: 10px; right: 10px; width: 26px; height: 26px; border-radius: 8px;
    border: 2px solid var(--line-strong); display: grid; place-items: center; color: transparent;
    transition: background var(--dur-fast) ease, border-color var(--dur-fast) ease, color var(--dur-fast) ease;
  }
  .on .mark { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
  .mark.round { border-radius: 50%; }
  .on .mark.round { background: transparent; }
  .dot { width: 12px; height: 12px; border-radius: 50%; background: currentColor; transform: scale(0); transition: transform var(--dur-fast) var(--ease-spring); }
  .on .mark.round { color: var(--accent); }
  .on .dot { transform: scale(1); }

  /* Tiles: the description cut to two lines. */
  .packlist:not(.rows) .blurb { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }

  /* Rows: the mark on the left, everything said, the pencil on the right. */
  .rows .pack { min-height: 72px; flex-direction: row; align-items: center; gap: var(--s-3); padding: var(--s-3) 60px var(--s-3) var(--s-3); }
  .rows .mark { position: static; flex: none; }
  .rows .txt { gap: 1px; }
  .rows .icon { flex: none; margin: 0; font-size: 1.5rem; }
  .rows .name { padding-right: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 2px var(--s-2); }
  .rows .meta { margin-top: 2px; padding: 0; min-height: 0; }
  .details { color: var(--text-faint); font-size: 0.78rem; line-height: 1.3; margin-top: 2px; }
  .tag {
    font-family: var(--font-body); font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
    padding: 1px 7px; border-radius: var(--r-pill); background: var(--overlay-strong); color: var(--text-dim);
  }

  .make { border-style: dashed; border-color: color-mix(in srgb, var(--accent) 55%, transparent); background: transparent; }
  .make .name { color: var(--accent); padding-right: 0; }
  .make .spark { position: static; border: 0; color: inherit; font-size: 1.4rem; width: auto; height: auto; margin-bottom: var(--s-1); align-self: flex-start; }
  .rows .make { padding-right: var(--s-3); }
  .rows .make .spark { width: 26px; margin: 0; align-self: center; }

  /* 48px to tap, drawn as a smaller circle so it reads as part of the pack. */
  .edit {
    position: absolute; bottom: 2px; right: 2px; width: 48px; height: 48px; padding: 0;
    border: 0; background: transparent; color: var(--text-dim); display: grid; place-items: center;
  }
  .rows .edit { bottom: auto; top: 50%; right: 4px; translate: 0 -50%; }
  .edit::before { content: ''; position: absolute; inset: 7px; border-radius: 50%; background: var(--overlay); border: 1.5px solid var(--line-strong); }
  .edit svg { position: relative; }
  .edit:active::before { background: color-mix(in srgb, var(--accent) 30%, var(--surface)); }
  .edit:focus-visible { outline-offset: -2px; border-radius: 50%; }

  /* A phone on its side: half a tile is enough before the whole screen scrolls. */
  @media (orientation: landscape) and (max-height: 500px) {
    .listing { min-height: 64px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .pack:active { transform: none; }
    .fold, .fold-toggle svg { transition: none; }
    .fold:not(.open) .fold-in { transition: none; }
  }
</style>
