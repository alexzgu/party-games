<script lang="ts">
  import { untrack, type Snippet } from 'svelte';
  import { SORTS, loadPrefs, savePrefs, type SortKey } from '../lib/listing';

  // A list's header row: a title on the left, small search and sort toggles on the right.
  // Search opens a slim bar; sort opens a row of chips. Both stay as the phone left them.
  let {
    key,
    query = $bindable(''),
    sort = $bindable<SortKey>('suggested'),
    placeholder = 'Search',
    shown,
    total,
    title,
    extra,
  }: {
    /** Remembers this list's toggles and order, e.g. 'forehead:decks'. */
    key: string;
    query?: string;
    sort?: SortKey;
    placeholder?: string;
    /** With a query: how many items match, to say "3 of 120". */
    shown?: number;
    total?: number;
    title?: Snippet;
    /** More controls at the end of the row (e.g. an "Edit decks" link). */
    extra?: Snippet;
  } = $props();

  // Read once on mount: a list's key never changes while it is on screen.
  const prefs = untrack(() => loadPrefs(key));
  let searching = $state(prefs.search);
  let sorting = $state(prefs.sorting);
  sort = prefs.sort;
  let input = $state<HTMLInputElement>();

  function persist() {
    savePrefs(key, { search: searching, sorting, sort });
  }
  function toggleSearch() {
    searching = !searching;
    if (!searching) query = '';
    else queueMicrotask(() => input?.focus());
    persist();
  }
  function toggleSort() {
    sorting = !sorting;
    persist();
  }
  function pick(v: SortKey) {
    sort = v;
    persist();
  }
</script>

<div class="tools">
  <div class="row">
    <div class="title">{@render title?.()}</div>
    <button class="icon" class:on={searching} aria-pressed={searching} aria-label="Search" onclick={toggleSearch} data-tip={searching ? 'Closes the search and shows everything' : 'Search this list'}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.4" /><path d="M15.5 15.5 20 20" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" /></svg>
    </button>
    <button class="icon" class:on={sorting || sort !== 'suggested'} aria-pressed={sorting} aria-label="Sort" onclick={toggleSort} data-tip="Change the order of this list">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M7 4v15M3.5 15.5 7 19l3.5-3.5M17 20V5M13.5 8.5 17 5l3.5 3.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>
    {@render extra?.()}
  </div>

  {#if searching}
    <label class="search fade-in">
      <input bind:this={input} type="search" bind:value={query} {placeholder} enterkeyhint="search" autocomplete="off" autocapitalize="off" spellcheck="false" />
      {#if query}
        {#if shown !== undefined && total !== undefined}<span class="count">{shown} of {total}</span>{/if}
        <button class="clear" aria-label="Clear search" onclick={() => { query = ''; input?.focus(); }}>✕</button>
      {/if}
    </label>
  {/if}

  {#if sorting}
    <div class="sorts fade-in" role="radiogroup" aria-label="Sort by">
      {#each SORTS as s (s.value)}
        <button role="radio" aria-checked={sort === s.value} class:on={sort === s.value} onclick={() => pick(s.value)} data-tip={s.value === 'suggested' ? 'The order this list comes in' : undefined}>{s.label}</button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .tools { display: flex; flex-direction: column; gap: var(--s-2); margin-bottom: var(--s-3); }
  .row { display: flex; align-items: center; gap: var(--s-1); min-height: 44px; }
  .title { flex: 1; min-width: 0; }
  .icon {
    flex: none; width: var(--tap-min); height: var(--tap-min); border: 0; border-radius: var(--r-pill); display: grid; place-items: center;
    color: var(--text-faint); background: transparent; transition: color var(--dur-fast), background var(--dur-fast);
  }
  .icon.on { color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); }
  .search {
    display: flex; align-items: center; gap: var(--s-2); height: 44px; padding: 0 6px 0 var(--s-4);
    background: var(--bg-sunk); border: 1.5px solid var(--line); border-radius: var(--r-pill);
  }
  .search:focus-within { border-color: color-mix(in srgb, var(--accent) 60%, var(--line)); }
  .search input { flex: 1; min-width: 0; height: 100%; background: none; border: 0; outline: 0; color: var(--text); font: inherit; font-size: max(16px, 1rem); }
  .search input::-webkit-search-cancel-button { display: none; }
  .count { flex: none; font-size: 0.8rem; color: var(--text-faint); }
  .clear { position: relative; flex: none; width: 32px; height: 32px; border: 0; border-radius: 50%; display: grid; place-items: center; color: var(--text-dim); background: var(--overlay); font-size: 0.8rem; }
  /* Small controls are tapped through a clear area 45 px tall and at least 44 px wide around them,
     drawn no bigger. It reaches into the gaps around them and never onto another control (the
     clear button's may lie over the edge of the "3 of 12" count, which is plain text). */
  .clear::after { content: ''; position: absolute; inset: -6.5px -6px; }
  /* Rows 8 px apart when the chips wrap, so no chip's tap area reaches a chip in the other row.
     With small text the two rows' areas can meet in the gap; there the lower row's takes the tap. */
  .sorts { display: flex; gap: 8px 6px; flex-wrap: wrap; }
  .sorts button {
    position: relative; padding: 7px 14px; border-radius: var(--r-pill); font-size: 0.88rem; font-weight: 600;
    min-height: calc(45px - 2 * var(--s-2)); /* Compact: the tap area stops at the controls above, var(--s-2) away */
    color: var(--text-dim); background: var(--surface); border: 1.5px solid var(--line);
  }
  .sorts button::after { content: ''; position: absolute; inset: min(0px, (100% - 45px) / 2) -1.5px; }
  .sorts button.on { color: var(--text); border-color: var(--accent); background: color-mix(in srgb, var(--accent) 16%, var(--surface)); }
</style>
