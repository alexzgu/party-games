<script lang="ts">
  import Popup from './Popup.svelte';
  import Button from './Button.svelte';
  import Toggle from './Toggle.svelte';
  import { GAMES, type GameId } from '../app.config';
  import { deleteCategory, MAX_OWN, NAME_MAX, nextId, putCategory, type OwnCategory } from '../lib/gamesView';
  import { gamesPage, setGamesPage } from '../lib/gamesPage.svelte';
  import { holdUpdates } from '../lib/update';

  // The phone's own categories on the Games page: the list of them with New, and one opened to
  // name it, choose its games or delete it (asked first, as every delete is).
  let { onclose }: { onclose: () => void } = $props();

  // A new app version waits while this is open, so typing is never lost to a reload.
  $effect(() => holdUpdates());

  /** The category being made or changed; null on the list. */
  let draft = $state<OwnCategory | null>(null);
  let isNew = $state(false);
  let problem = $state('');
  let asking = $state(false);

  const snap = () => $state.snapshot(gamesPage);
  const full = $derived(gamesPage.own.length >= MAX_OWN);
  const count = (n: number) => `${n} game${n === 1 ? '' : 's'}`;

  function edit(c: OwnCategory | null) {
    isNew = !c;
    draft = c ? { ...c, games: [...c.games] } : { id: nextId(gamesPage.own), name: '', games: [] };
    problem = '';
  }

  function has(id: GameId, on: boolean) {
    if (!draft) return;
    draft.games = on ? [...draft.games, id] : draft.games.filter((g) => g !== id);
  }

  function saveDraft(e?: SubmitEvent) {
    e?.preventDefault();
    if (!draft) return;
    const next = putCategory(snap(), $state.snapshot(draft));
    if (typeof next === 'string') { problem = next; return; }
    setGamesPage(next);
    draft = null;
  }

  function remove() {
    if (draft) setGamesPage(deleteCategory(snap(), draft.id));
    asking = false;
    draft = null;
  }

  const focus = (el: HTMLElement) => { el.focus({ preventScroll: true }); };
</script>

<Popup title={draft ? (isNew ? 'New category' : 'Edit category') : 'Your categories'} onclose={draft ? () => (draft = null) : onclose}>
  {#if draft}
    <form class="form" onsubmit={saveDraft}>
      <label class="name">
        <span>Name</span>
        <input type="text" bind:value={draft.name} maxlength={NAME_MAX * 2} autocomplete="off" enterkeyhint="done" oninput={() => (problem = '')} use:focus />
      </label>
      {#if problem}<p class="bad" role="alert">{problem}</p>{/if}
      <p class="dim">Games in it</p>
      <div class="games">
        {#each GAMES as g (g.id)}
          <Toggle label="{g.emoji} {g.name}" bind:checked={() => !!draft?.games.includes(g.id), (on) => has(g.id, on)} />
        {/each}
      </div>
    </form>
  {:else}
    {#if gamesPage.own.length}
      <ul class="list">
        {#each gamesPage.own as c (c.id)}
          <li>
            <button class="row" onclick={() => edit(c)} aria-label="Edit {c.name}">
              <span class="cname">{c.name}</span><span class="dim">{count(c.games.length)}</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="dim">Make your own categories, such as the games for a quiet night, and pick them above the games.</p>
    {/if}
    {#if full}<p class="dim">That is the most: {MAX_OWN} categories.</p>{/if}
  {/if}
  {#snippet footer()}
    <div class="foot">
      {#if draft}
        {#if !isNew}<Button variant="danger" size="sm" onclick={() => (asking = true)}>Delete</Button>{/if}
        <Button variant="secondary" size="sm" onclick={() => (draft = null)}>Cancel</Button>
        <Button size="sm" onclick={() => saveDraft()}>Save</Button>
      {:else}
        <Button variant="secondary" size="sm" disabled={full} onclick={() => edit(null)} tip="Makes a category of games on this phone">New</Button>
        <Button size="sm" onclick={onclose}>Done</Button>
      {/if}
    </div>
  {/snippet}
</Popup>

<!-- Over the editor, so each returns focus to what opened it. -->
{#if asking && draft}
  <Popup title="Delete this category?" onclose={() => (asking = false)}>
    <div class="form">
      <p>“{gamesPage.own.find((c) => c.id === draft?.id)?.name}” is deleted from this device. Its games stay.</p>
      <Button variant="danger" onclick={remove}>Delete</Button>
      <Button variant="secondary" onclick={() => (asking = false)}>Keep it</Button>
    </div>
  </Popup>
{/if}

<style>
  .form { display: flex; flex-direction: column; gap: var(--s-3); }
  .form p { margin: 0; }
  .name { display: flex; flex-direction: column; gap: var(--s-1); font-weight: 600; color: var(--text-dim); }
  .games { display: flex; flex-direction: column; gap: var(--s-2); }
  .dim { margin: 0; color: var(--text-dim); font-weight: 600; font-size: 0.92rem; }
  .bad { color: var(--bad-ink); font-weight: 600; }
  .list { list-style: none; margin: 0 0 var(--s-3); padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  .row {
    width: 100%; min-height: var(--tap); display: flex; align-items: center; justify-content: space-between; gap: var(--s-3);
    padding: var(--s-2) var(--s-4); border: 1.5px solid var(--line); border-radius: var(--r-md); background: var(--surface); text-align: left;
  }
  .cname { font-weight: 700; overflow-wrap: anywhere; }
  .row .dim { flex: none; }
  .foot { display: flex; gap: var(--s-2); }
  .foot > :global(*) { flex: 1 1 0; }
</style>
