<script lang="ts">
  import type { PackGameId } from '../app.config';
  import ListTools from './ListTools.svelte';
  import PackFile from './PackFile.svelte';
  import PinnedPanel from './PinnedPanel.svelte';
  import { afterImport, findEntries, pickedLine, tapped, type PackEntry } from '../lib/packList';
  import type { SortKey } from '../lib/listing';
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
  // row (New, Community, Import; Export), just over the start bar (the layout: PinnedPanel).
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
    toolsKey = `${game}:packs`,
    footNote,
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
    /** Where search and sort are remembered: a game playing another game's packs keeps its own. */
    toolsKey?: string;
    /** Under the packs, in place of "Make a pack" (a game playing another game's packs says where to make them). */
    footNote?: string;
    /** The pencil on each pack; without it packs are only picked here. */
    onedit?: (id: string) => void;
    /** "Make a pack" and Add pack → New: the game's way to make a pack; without it neither shows. */
    onmake?: () => void;
    /** After an import: the parent reloads `entries`. */
    onimported: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  const ready = tapGuard(guard);
  // The tiles/list switch sits where the last screen's buttons often were: a double tap there is ignored.
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

  const topId = $derived(`${game}-top`);

  function switchView() {
    if (!settled()) return;
    settings.packView = rows ? 'tiles' : 'rows';
    saveSettings();
  }
</script>

{#snippet pencil()}
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg>
{/snippet}

<PinnedPanel label={headId} foldId={topId} foldName={topName} needed={topNeeded} keep="packs" {notice} {top}>
  {#snippet row(toggle)}
    <ListTools key={toolsKey} bind:query bind:sort {placeholder} shown={shown.length} total={entries.length}>
      {#snippet title()}
        <div class="head">
          <h3 id={headId}>{heading}</h3>
          <span class="picked">{pickedLine(entries, selected, noun, single)}</span>
        </div>
      {/snippet}
      {#snippet extra()}
        <button class="view" aria-label={rows ? 'Show packs as tiles' : 'Show packs as a list'} onclick={switchView} data-tip={rows ? 'Shows packs as tiles, in every game' : 'Shows packs as a list, in every game'}>
          {#if rows}
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/></g></svg>
          {:else}
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
          {/if}
        </button>
        {@render toggle()}
      {/snippet}
    </ListTools>
  {/snippet}

  {#if searching && !shown.length}<p class="none">No packs match “{query.trim()}”</p>{/if}
  <ul class="items" class:rows role={single ? 'radiogroup' : 'list'} aria-labelledby={headId}>
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
        {#if onedit}<button class="edit" onclick={() => ready() && onedit(e.id)} aria-label="See and edit {e.name}">{@render pencil()}</button>{/if}
      </li>
    {/each}
    {#if !searching && onmake}
      <li class="item">
        <button class="pack make" onclick={() => ready() && onmake()} data-tip="Make a new pack yourself or with Fizzwick">
          <span class="mark spark" aria-hidden="true">✨</span>
          <span class="txt">
            <span class="name">Make a pack</span>
            <span class="blurb">{makeHint}</span>
          </span>
        </button>
      </li>
    {/if}
  </ul>
  {#if footNote}<p class="note">{footNote}</p>{/if}

  {#snippet foot()}<PackFile {game} {onmake} onimported={imported} />{/snippet}
</PinnedPanel>

<style>
  .head { display: flex; flex-direction: column; min-width: 0; }
  .picked { color: var(--text-faint); font-size: 0.85rem; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .view {
    flex: none; width: var(--tap-min); height: var(--tap-min); border: 0; border-radius: var(--r-pill); display: grid; place-items: center;
    color: var(--text-faint); background: transparent;
  }
  .view:active { background: var(--overlay); }
  .none { margin: 0 0 var(--s-3); color: var(--text-dim); text-align: center; }
  .note { margin: var(--s-3) 0 0; color: var(--text-dim); font-size: 0.9rem; text-align: center; }

  .items { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--s-2); }
  .items.rows { grid-template-columns: minmax(0, 1fr); }
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
  .items:not(.rows) .blurb { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }

  /* Rows: the mark on the left, everything said, the pencil on the right. */
  .rows .pack { min-height: var(--tap-xxl); flex-direction: row; align-items: center; gap: var(--s-3); padding: var(--s-3) 60px var(--s-3) var(--s-3); }
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

  @media (prefers-reduced-motion: reduce) {
    .pack:active { transform: none; }
  }
</style>
