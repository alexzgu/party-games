<script lang="ts">
  import { onDestroy } from 'svelte';
  import Screen from './Screen.svelte';
  import Button from './Button.svelte';
  import Segmented from './Segmented.svelte';
  import MagicWords from './MagicWords.svelte';
  import CommunityItems from './CommunityItems.svelte';
  import type { PackGameId } from '../app.config';
  import { hasKey } from '../lib/claude';
  import { failureWords, getPack, hasPass, importLibraryPack, listPacks, starPack, type Failure, type LibraryFull, type LibraryPack, type Sort } from '../lib/library';
  import { unitOf, type ImportResult } from '../lib/packfile';
  import { sfx } from '../lib/sound';

  // The Community library for one game: packs Fizzwick made on friends' phones. Search names and
  // descriptions, most stars or newest first, tap one to see everything in it, then import it
  // (saved like a pack file) or star it (with the magic words). Opened from the pack list.
  let { game, onclose, onimport }: {
    game: PackGameId;
    onclose: () => void;
    /** A pack was saved on this phone. */
    onimport: (r: Exclude<ImportResult, { error: string }>) => void;
  } = $props();

  const SORTS = [{ value: 'stars' as Sort, label: 'Most stars' }, { value: 'new' as Sort, label: 'Newest' }];
  let query = $state('');
  let sort = $state<Sort>('stars');
  // Raw state: packs are replaced whole, never deep-proxied or deep-copied.
  let packs = $state.raw<LibraryPack[]>([]);
  let more = $state(false);
  let page = 1;
  let phase = $state<'loading' | 'ready' | 'failed'>('loading');
  let failure = $state<Failure>('server');
  let loadingMore = $state(false);
  let ctrl: AbortController | null = null;

  /** The pack open in the preview, while it loads and once it has. */
  let openId = $state<string | null>(null);
  let open = $state.raw<LibraryFull | null>(null);
  let openFailure = $state<Failure | null>(null);
  let starring = $state(false);
  let starNote = $state('');
  let askWords = $state(false);
  let importError = $state('');
  const gone = new AbortController();
  onDestroy(() => { gone.abort(); ctrl?.abort(); });

  const count = (n: number) => `${n} ${unitOf(game, n)}`;

  async function load(first: boolean) {
    ctrl?.abort();
    const c = (ctrl = new AbortController());
    if (first) { page = 1; phase = 'loading'; } else loadingMore = true;
    const r = await listPacks(game, { q: query, sort, page: first ? 1 : page + 1, signal: c.signal });
    if (c.signal.aborted) return;
    loadingMore = false;
    if (!r.ok) {
      failure = r.reason === 'missing' ? 'server' : r.reason; // no list at all: a server without the library
      if (first) phase = 'failed';
      return;
    }
    if (!first) page++;
    packs = first ? r.packs : [...packs, ...r.packs.filter((p) => !packs.some((q) => q.id === p.id))];
    more = r.more;
    phase = 'ready';
  }

  // A new search waits for the typing to stop; a new order loads at once.
  let lastQuery = '';
  $effect(() => {
    const q = query.trim();
    void sort;
    const wait = q === lastQuery ? 0 : 300;
    lastQuery = q;
    const t = setTimeout(() => void load(true), wait);
    return () => clearTimeout(t);
  });

  async function preview(id: string) {
    openId = id;
    open = null;
    openFailure = null;
    starNote = '';
    importError = '';
    askWords = false;
    const r = await getPack(game, id, gone.signal);
    if (gone.signal.aborted || openId !== id) return;
    if (r.ok) open = r.pack;
    else openFailure = r.reason;
  }

  function closePreview() {
    openId = null;
    open = null;
  }

  // Once the magic words are said here, the open pack is read again to learn whether it is starred.
  $effect(() => {
    if (askWords && hasPass() && openId) {
      askWords = false;
      void preview(openId);
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
    packs = packs.map((p) => (p.id === id ? { ...p, stars: r.stars, starred: r.starred } : p));
  }

  function take() {
    if (!open) return;
    const r = importLibraryPack(game, open);
    if ('error' in r) { importError = r.error; return; }
    sfx.correct();
    onimport(r);
  }
</script>

{#if openId}
  <Screen title={open?.name ?? 'Community pack'} onback={closePreview} backLabel="Back to the Community packs">
    {#if open}
      <div class="about">
        {#if open.blurb}<p class="blurb">{open.blurb}</p>{/if}
        <p class="faint">{count(open.count)} · ★ {open.stars}</p>
        {#if open.username}<p><span class="who">{open.username}</span></p>{/if}
      </div>
      <div class="star">
        {#if hasPass()}
          <Button variant="secondary" size="sm" onclick={toggleStar} disabled={starring}>{open.starred ? '★ Starred' : '☆ Star it'}</Button>
        {:else}
          <button type="button" class="hint" onclick={() => (askWords = !askWords)} aria-expanded={askWords}>☆ Say the magic words to star packs</button>
        {/if}
      </div>
      {#if askWords}
        {#if hasKey()}<p class="faint small">Stars need the magic words; this phone uses the host's key.</p>
        {:else}<MagicWords intro="Say the magic words the host told you:" />{/if}
      {/if}
      {#if starNote}<p class="bad small" role="status">{starNote}</p>{/if}
      <CommunityItems {game} items={open.items} extra={open.extra} />
    {:else if openFailure}
      <div class="state">
        <p>{failureWords(openFailure)}</p>
        {#if openFailure !== 'missing'}<Button variant="secondary" size="sm" onclick={() => openId && preview(openId)}>Try again</Button>{/if}
      </div>
    {:else}
      <p class="faint state" role="status">Opening the pack…</p>
    {/if}
    {#snippet actions()}
      {#if importError}<p class="bad small" role="alert">{importError}</p>{/if}
      {#if open}<Button size="lg" onclick={take}>Import</Button>{/if}
    {/snippet}
  </Screen>
{:else}
  <Screen title="Community" onback={onclose} backLabel="Back to the packs">
    <p class="faint intro">Packs Fizzwick made on friends' phones. Open one to see everything in it.</p>
    <input type="text" inputmode="search" placeholder="Search names and descriptions" bind:value={query} maxlength="100" autocomplete="off" enterkeyhint="search" aria-label="Search Community packs" />
    <Segmented label="Order" options={SORTS} bind:value={sort} />
    {#if phase === 'loading'}
      <p class="faint state" role="status">Looking through the library…</p>
    {:else if phase === 'failed'}
      <div class="state">
        <p>{failureWords(failure)}</p>
        <Button variant="secondary" size="sm" onclick={() => load(true)}>Try again</Button>
      </div>
    {:else if !packs.length}
      <p class="faint state">{query.trim() ? `No packs match “${query.trim()}”.` : 'No packs here yet. Packs Fizzwick makes show up here.'}</p>
    {:else}
      <ul class="list">
        {#each packs as p (p.id)}
          <li>
            <button class="row" onclick={() => preview(p.id)}>
              <span class="txt">
                <span class="name">{p.name}</span>
                {#if p.blurb}<span class="blurb">{p.blurb}</span>{/if}
                <span class="faint meta">{count(p.count)}{#if p.username}<span class="who">{p.username}</span>{/if}</span>
              </span>
              <span class="stars" class:mine={p.starred} aria-label="{p.stars} stars">★ {p.stars}</span>
            </button>
          </li>
        {/each}
      </ul>
      {#if more}
        <Button variant="secondary" onclick={() => load(false)} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Show more'}</Button>
      {/if}
    {/if}
  </Screen>
{/if}

<style>
  .intro { margin: 0; font-size: 0.95rem; line-height: 1.3; }
  .state { display: flex; flex-direction: column; align-items: flex-start; gap: var(--s-2); margin: 0; padding: var(--s-2) 0; }
  .state p { margin: 0; }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  .row {
    width: 100%; display: flex; align-items: center; gap: var(--s-3); padding: var(--s-3) var(--s-4); min-height: 68px;
    border: 0; border-radius: var(--r-md); background: var(--surface); text-align: left; color: var(--text);
    transition: transform var(--dur-fast) var(--ease-out);
  }
  .row:active { transform: scale(0.98); }
  .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .name { font-family: var(--font-display); font-weight: 800; font-size: 1.15rem; overflow-wrap: anywhere; }
  .blurb { color: var(--text-dim); font-size: 0.9rem; line-height: 1.25; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
  .meta { font-size: 0.85rem; display: flex; align-items: center; flex-wrap: wrap; gap: 2px var(--s-2); }
  /* The sharing phone's username: a small, quiet chip. */
  .who {
    display: inline-block; max-width: 100%; padding: 1px var(--s-2); border-radius: var(--r-pill); background: var(--overlay);
    color: var(--text-faint); font-size: 0.8rem; font-weight: 600; overflow-wrap: anywhere;
  }
  .stars { flex: none; font-weight: 800; color: var(--text-dim); }
  .stars.mine { color: var(--accent); }
  .about { display: flex; flex-direction: column; gap: 2px; }
  .about p { margin: 0; }
  .about .blurb { -webkit-line-clamp: unset; line-clamp: unset; display: block; }
  .star { display: flex; align-items: center; flex-wrap: wrap; gap: var(--s-2) var(--s-3); }
  .small { font-size: 0.9rem; }
  .hint {
    min-height: 44px; padding: 0 var(--s-3); border: 1.5px dashed var(--line-strong); border-radius: var(--r-pill);
    background: transparent; color: var(--text-dim); font-weight: 600; font-size: 0.9rem;
  }
  .bad { margin: 0; color: var(--bad-ink); font-weight: 600; }
</style>
