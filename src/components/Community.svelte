<script lang="ts">
  import { onDestroy, untrack, type Snippet } from 'svelte';
  import Screen from './Screen.svelte';
  import Button from './Button.svelte';
  import Segmented from './Segmented.svelte';
  import MagicWords from './MagicWords.svelte';
  import CommunityFilters from './CommunityFilters.svelte';
  import CommunityItems from './CommunityItems.svelte';
  import CommunityRow from './CommunityRow.svelte';
  import type { PackGameId } from '../app.config';
  import { hasKey } from '../lib/claude';
  import { failureWords, getPack, hasPass, importLibraryPack, listPacks, namesIfImported, namesNote, ownedIds, starPack, type Failure, type LibraryFull, type LibraryPack, type Sort } from '../lib/library';
  import { cachedListing, keepListing, listingKey, starInListings, type Listing } from '../lib/communityCache';
  import { isSkipped, rereadMarks, setSkipped } from '../lib/communityMarks.svelte';
  import { rereadShared } from '../lib/shareLog.svelte';
  import { ENOUGH, fits, hasMore, loadPages } from '../lib/communityPages';
  import { addedNote, readFilters, readView, viewUrl, type CommunityView, type Filters } from '../lib/communityView';
  import { NO_ROOM, unitOf, type ImportResult } from '../lib/packfile';
  import { back, go, route, swap } from '../lib/router.svelte';
  import { sfx } from '../lib/sound';

  // The Community library for one game: packs Fizzwick made on friends' phones. Search names and
  // descriptions, most stars or newest first, filter by what this phone has or skips, tap one to
  // see everything in it, then import it (saved like a pack file), skip it or star it (with the
  // magic words). Opened over a game's pack list and as the Community page
  // (pages/CommunityPage.svelte). The search, order, filters and open pack live in the address
  // (communityView.ts; the preview is its own history entry) and loaded lists, unfiltered, in
  // communityCache.ts, so Back, a reload or an import finds the list as it was left.
  let { game, onclose, onimport, stay = false, closeLabel = 'Back to the packs', tabs }: {
    game: PackGameId;
    onclose: () => void;
    /** A pack was saved on this phone. */
    onimport: (r: Exclude<ImportResult, { error: string }>) => void;
    /** After an import, back to the list with a note (the Community page); else the host closes it. */
    stay?: boolean;
    closeLabel?: string;
    /** Above the list, under the header (the Community page's game tabs). */
    tabs?: Snippet;
  } = $props();

  const SORTS = [{ value: 'stars' as Sort, label: 'Most stars' }, { value: 'new' as Sort, label: 'Newest' }];
  const view = $derived(readView(route.params));
  const filters = $derived(readFilters(route.params));
  const setView = (patch: Partial<CommunityView & Filters>) => swap(viewUrl(route.path, route.params, patch));

  // What is typed; it reaches the address (and the list) once the typing stops.
  // svelte-ignore state_referenced_locally
  let query = $state(view.q);
  $effect(() => {
    const q = query.trim();
    if (q === untrack(() => view.q)) return;
    const t = setTimeout(() => setView({ q }), 300);
    return () => clearTimeout(t);
  });

  const key = $derived(listingKey(game, view.q, view.sort));
  // Raw state: lists are replaced whole, never deep-proxied or deep-copied. A list kept from
  // before shows at once, so the router can put its scroll back.
  // svelte-ignore state_referenced_locally
  let listing = $state.raw<Listing | null>(cachedListing(key) ?? null);
  let failure = $state<Failure | null>(null);
  let moreFailure = $state<Failure | null>(null);
  let loadingMore = $state(false);
  /** What the Community page says after an import, until the next search, tab or preview. */
  let note = $state('');
  let ctrl: AbortController | null = null;
  let shownKey = '';

  const count = (n: number) => `${n} ${unitOf(game, n)}`;

  /** Bumped when packs or marks may have changed elsewhere (another tab), so they are read again. */
  let packsSeen = $state(0);
  function look() {
    rereadMarks();
    rereadShared();
    packsSeen++;
  }
  // Read once per change, not per row.
  const mine = $derived.by(() => { void packsSeen; return ownedIds(game); });
  const owned = (p: LibraryPack): boolean => mine.has(p.id);
  const fitting = (packs: readonly LibraryPack[]) => packs.filter((p) => fits(filters, { owned: owned(p), skipped: isSkipped(game, p.id) }));
  const shown = $derived(fitting(listing?.packs ?? []));

  /** Loads the first page, or the pages after the list's, until `want` packs fit the filters. */
  async function load(first: boolean, want = ENOUGH) {
    ctrl?.abort();
    const c = (ctrl = new AbortController());
    const k = key;
    const { q, sort } = view;
    const base = first ? null : listing;
    if (first) listing = null;
    failure = moreFailure = null;
    loadingMore = true;
    const reason = await loadPages(base, (page) => listPacks(game, { q, sort, page, signal: c.signal }),
      (l) => fitting(l.packs).length >= want, (l) => { listing = l; keepListing(k, l); }, () => c.signal.aborted);
    if (c.signal.aborted) return;
    loadingMore = false;
    if (!reason) return;
    const f = reason === 'missing' ? 'server' : reason; // no list at all: a server without the library
    if (listing) moreFailure = f; else failure = f;
  }

  // A new game, search or order shows its kept list, else loads its first page.
  $effect(() => {
    const k = key;
    untrack(() => {
      if (k === shownKey) return;
      const switched = !!shownKey;
      if (switched) note = '';
      shownKey = k;
      ctrl?.abort();
      loadingMore = false;
      moreFailure = null;
      const kept = cachedListing(k);
      if (!kept) { void load(true); return; }
      listing = kept;
      failure = null;
      if (switched) fillUp();
    });
  });

  /** A press that left too few packs on screen loads further pages. */
  function fillUp() {
    if (listing && !loadingMore && hasMore(listing) && shown.length < ENOUGH) void load(false);
  }

  function filter(f: Partial<Filters>) {
    note = '';
    setView(f);
    fillUp();
  }

  function skip() {
    if (!open) return;
    const on = !isSkipped(game, open.id);
    starNote = '';
    if (!setSkipped(game, open.id, on)) starNote = NO_ROOM;
    else if (on) closePreview();
  }

  /** The pack open in the preview (from the address), while it loads and once it has. */
  const openId = $derived(view.pack);
  let open = $state.raw<LibraryFull | null>(null);
  /** The names the open pack would be saved under. */
  const names = $derived.by(() => { void packsSeen; return open ? namesIfImported(game, open) : []; });
  let openFailure = $state<Failure | null>(null);
  let starring = $state(false);
  let starNote = $state('');
  let askWords = $state(false);
  let importError = $state('');
  const gone = new AbortController();
  onDestroy(() => { gone.abort(); ctrl?.abort(); });
  let wrap: HTMLElement | undefined = $state();

  async function fetchPreview(id: string) {
    open = null;
    openFailure = null;
    const r = await getPack(game, id, gone.signal);
    if (gone.signal.aborted || openId !== id) return;
    if (r.ok) open = r.pack;
    else openFailure = r.reason;
  }

  $effect(() => {
    const id = openId;
    untrack(() => {
      starNote = '';
      importError = '';
      askWords = false;
      if (!id) { open = null; openFailure = null; packsSeen++; return; } // an import just now counts as owned
      // A layer scrolling on its own (the overlay) shows the preview from its top; the page's own
      // scroll is the router's.
      wrap?.closest<HTMLElement>('[data-keep-scroll]')?.scrollTo(0, 0);
      void fetchPreview(id);
    });
  });

  function preview(id: string) {
    const q = query.trim();
    if (q !== view.q) setView({ q }); // a search still being typed is kept for Back
    note = '';
    go(viewUrl(route.path, route.params, { pack: id }));
  }

  const closePreview = () => back(viewUrl(route.path, route.params, { pack: null }));

  // Once the magic words are said here, the open pack is read again to learn whether it is starred.
  $effect(() => {
    if (askWords && hasPass() && openId) {
      askWords = false;
      void fetchPreview(openId);
    }
  });

  async function toggleStar() {
    if (!open || starring) return;
    starNote = '';
    starring = true;
    const id = open.id;
    const r = await starPack(id, !open.starred);
    starring = false;
    if (gone.signal.aborted) return;
    if (!r.ok) {
      starNote = failureWords(r.reason);
      // An expired or refused pass was forgotten (library.ts): the words box comes back here.
      if (r.reason === 'pass') askWords = true;
      return;
    }
    if (r.starred) sfx.tick();
    if (open?.id === id) open = { ...open, stars: r.stars, starred: r.starred };
    starInListings(id, r.stars, r.starred);
    listing = cachedListing(key) ?? listing;
  }

  /** The preview last imported: a second tap on Import (a double tap) imports nothing and goes back once. */
  let taken: LibraryFull | null = null;
  function take() {
    if (!open || taken === open) return;
    taken = open;
    const r = importLibraryPack(game, open);
    if ('error' in r) { importError = r.error; taken = null; return; }
    sfx.correct();
    onimport(r);
    if (!stay) return;
    note = addedNote(game, r);
    closePreview();
  }
</script>

{#snippet added()}
  <div class="added">
    <p role="status">{note}</p>
    <button type="button" class="hide" aria-label="Hide this note" onclick={() => (note = '')}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>
    </button>
  </div>
{/snippet}

<svelte:window onstorage={look} onfocus={look} />
<svelte:document onvisibilitychange={look} />

<div class="community" bind:this={wrap}>
{#if openId}
  <Screen title={names[0] ?? open?.name ?? 'Community pack'} onback={closePreview} backLabel="Back to the Community packs">
    {#if open}
      <div class="about">
        {#if open.blurb}<p class="blurb">{open.blurb}</p>{/if}
        <p class="faint">{count(open.count)} · ★ {open.stars}</p>
        {#if namesNote(open.name, names)}<p class="small saves">{namesNote(open.name, names)}</p>{/if}
        {#if open.leftOut}<p class="faint small">{open.leftOut} more left out: already in the built-in packs, or not usable in this game.</p>{/if}
        {#if open.username}<p><span class="who">{open.username}</span></p>{/if}
      </div>
      <div class="star">
        {#if hasPass()}
          <Button variant="secondary" size="sm" onclick={toggleStar} disabled={starring} tip={open.starred ? 'Takes your star back' : 'Adds your star to this pack'}>{open.starred ? '★ Starred' : '☆ Star it'}</Button>
        {:else}
          <button type="button" class="hint" onclick={() => (askWords = !askWords)} aria-expanded={askWords} data-tip="Starring needs the magic words the host told you">☆ Say the magic words to star packs</button>
        {/if}
        <Button variant="secondary" size="sm" onclick={skip} tip={isSkipped(game, open.id) ? 'Lists this pack again on this phone' : 'Leaves this pack out of the list on this phone'}>{isSkipped(game, open.id) ? 'Unskip' : 'Skip'}</Button>
      </div>
      {#if askWords}
        {#if hasKey()}<p class="faint small">Stars need the magic words; this phone uses the host's key.</p>
        {:else}<MagicWords intro="Say the magic words the host told you:" />{/if}
      {/if}
      {#if starNote}<p class="bad small" role="status">{starNote}</p>{/if}
      {#if open.ready && 'error' in open.ready}<p class="faint">{open.ready.error}</p>
      {:else}<CommunityItems {game} items={open.items} extra={open.extra} />{/if}
    {:else if openFailure}
      <div class="state">
        <p>{failureWords(openFailure)}</p>
        {#if openFailure !== 'missing'}<Button variant="secondary" size="sm" onclick={() => openId && fetchPreview(openId)}>Try again</Button>{/if}
      </div>
    {:else}
      <p class="faint state" role="status">Opening the pack…</p>
    {/if}
    {#snippet actions()}
      {#if importError}<p class="bad small" role="alert">{importError}</p>{/if}
      {#if open}<Button size="lg" onclick={take} disabled={!!open.ready && 'error' in open.ready} tip="Saves this pack on this device so you can play it">Import</Button>{/if}
    {/snippet}
  </Screen>
{:else}
  <Screen title="Community" onback={onclose} backLabel={closeLabel} actions={note ? added : undefined}>
    {@render tabs?.()}
    <p class="faint intro">Packs Fizzwick made on friends' phones. Open one to see everything in it.</p>
    <input type="text" inputmode="search" placeholder="Search names and descriptions" bind:value={query} maxlength="100" autocomplete="off" enterkeyhint="search" aria-label="Search Community packs" />
    <Segmented label="Order" options={SORTS} bind:value={() => view.sort, (sort) => setView({ sort })} />
    <CommunityFilters {filters} onchange={filter} />
    {#if failure}
      <div class="state">
        <p>{failureWords(failure)}</p>
        <Button variant="secondary" size="sm" onclick={() => load(true)}>Try again</Button>
      </div>
    {:else if !listing || (loadingMore && !shown.length)}
      <p class="faint state" role="status">Looking through the library…</p>
    {:else if !listing.packs.length}
      <p class="faint state">{view.q ? `No packs match “${view.q}”.` : 'No packs here yet. Packs Fizzwick makes show up here.'}</p>
    {:else}
      {#if !shown.length}<p class="faint state">{hasMore(listing) ? 'None of the packs loaded so far fit these filters.' : 'No packs fit these filters.'}</p>{/if}
      <ul class="list">
        {#each shown as p (p.id)}
          <li>
            <CommunityRow pack={p} owned={owned(p)} skipped={isSkipped(game, p.id)} onopen={() => preview(p.id)} />
          </li>
        {/each}
      </ul>
      {#if moreFailure}<p class="bad small" role="status">{failureWords(moreFailure)}</p>{/if}
      {#if hasMore(listing)}
        <Button variant="secondary" onclick={() => load(false, shown.length + ENOUGH)} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Show more'}</Button>
      {/if}
    {/if}
  </Screen>
{/if}
</div>

<style>
  .community { display: contents; }
  .intro { margin: 0; font-size: 0.95rem; line-height: 1.3; }
  .state { display: flex; flex-direction: column; align-items: flex-start; gap: var(--s-2); margin: 0; padding: var(--s-2) 0; }
  .state p { margin: 0; }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  /* The sharing phone's username: a small, quiet chip. */
  .who {
    display: inline-block; max-width: 100%; padding: 1px var(--s-2); border-radius: var(--r-pill); background: var(--overlay);
    color: var(--text-faint); font-size: 0.8rem; font-weight: 600; overflow-wrap: anywhere;
  }
  .about { display: flex; flex-direction: column; gap: 2px; }
  .about p { margin: 0; }
  .about .blurb { color: var(--text-dim); font-size: 0.9rem; line-height: 1.25; overflow-wrap: anywhere; }
  .star { display: flex; align-items: center; flex-wrap: wrap; gap: var(--s-2) var(--s-3); }
  .small { font-size: 0.9rem; }
  .saves { color: var(--text-dim); font-weight: 600; }
  .hint {
    min-height: 44px; padding: 0 var(--s-3); border: 1.5px dashed var(--line-strong); border-radius: var(--r-pill);
    background: transparent; color: var(--text-dim); font-weight: 600; font-size: 0.9rem;
  }
  .bad { margin: 0; color: var(--bad-ink); font-weight: 600; }
  /* The note after an import, pinned at the bottom over the list it came back to. */
  .added { display: flex; align-items: center; gap: var(--s-2); padding: var(--s-2) var(--s-2) var(--s-2) var(--s-4); border-radius: var(--r-md); background: color-mix(in srgb, var(--c-good) 18%, var(--surface)); }
  .added p { flex: 1; margin: 0; font-weight: 600; font-size: 0.95rem; line-height: 1.3; overflow-wrap: anywhere; }
  .hide { flex: none; width: 44px; height: 44px; display: grid; place-items: center; border: 0; border-radius: var(--r-pill); background: transparent; color: var(--text-dim); }
</style>
