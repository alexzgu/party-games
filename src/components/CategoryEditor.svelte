<script lang="ts">
  import { tick } from 'svelte';
  import Popup from './Popup.svelte';
  import Button from './Button.svelte';
  import Toggle from './Toggle.svelte';
  import { GAMES, type GameId } from '../app.config';
  import { deleteCategory, MAX_OWN, NAME_MAX, nextId, putCategory, type OwnCategory } from '../lib/gamesView';
  import { gamesPage, setGamesPage } from '../lib/gamesPage.svelte';
  import { holdUpdates } from '../lib/update';

  // One of the phone's own categories on the Games page, opened from the categories menu: a new
  // one (`category` null) or one to rename, choose games for or delete (asked first, in a popup over
  // this one, so each gives focus back to what opened it).
  let { category, onclose }: { category: OwnCategory | null; onclose: () => void } = $props();

  // A new app version waits while this is open, so typing is never lost to a reload.
  $effect(() => holdUpdates());

  // svelte-ignore state_referenced_locally
  let draft = $state<OwnCategory>(category ? { ...category, games: [...category.games] } : { id: nextId(gamesPage.own), name: '', games: [] });
  // svelte-ignore state_referenced_locally
  const isNew = !category;
  let problem = $state('');
  let asking = $state(false);

  const snap = () => $state.snapshot(gamesPage);
  const full = $derived(isNew && gamesPage.own.length >= MAX_OWN);

  function has(id: GameId, on: boolean) {
    draft.games = on ? [...draft.games, id] : draft.games.filter((g) => g !== id);
  }

  function save(e?: SubmitEvent) {
    e?.preventDefault();
    const next = putCategory(snap(), $state.snapshot(draft));
    if (typeof next === 'string') { problem = next; return; }
    setGamesPage(next);
    onclose();
  }

  function remove() {
    setGamesPage(deleteCategory(snap(), draft.id));
    asking = false;
    onclose();
  }

  // The name takes focus once the popup has put it on its ✕ (it does so after this mounts).
  const focus = (el: HTMLElement) => { void tick().then(() => el.focus({ preventScroll: true })); };
</script>

<Popup title={isNew ? 'New category' : 'Edit category'} {onclose}>
  {#if full}
    <p class="dim">That is the most: {MAX_OWN} categories. Delete one to make another.</p>
  {:else}
    <form class="form" onsubmit={save}>
      <label class="name">
        <span>Name</span>
        <input type="text" bind:value={draft.name} maxlength={NAME_MAX * 2} autocomplete="off" enterkeyhint="done" oninput={() => (problem = '')} use:focus />
      </label>
      {#if problem}<p class="bad" role="alert">{problem}</p>{/if}
      <p class="dim">Games in it</p>
      <div class="games">
        {#each GAMES as g (g.id)}
          <Toggle label="{g.emoji} {g.name}" bind:checked={() => draft.games.includes(g.id), (on) => has(g.id, on)} />
        {/each}
      </div>
    </form>
  {/if}
  {#snippet footer()}
    <div class="foot">
      {#if !isNew}<Button variant="danger" size="sm" onclick={() => (asking = true)}>Delete</Button>{/if}
      <Button variant="secondary" size="sm" onclick={onclose}>Cancel</Button>
      {#if !full}<Button size="sm" onclick={() => save()}>Save</Button>{/if}
    </div>
  {/snippet}
</Popup>

<!-- Over the editor, so each returns focus to what opened it. -->
{#if asking}
  <Popup title="Delete this category?" onclose={() => (asking = false)}>
    <div class="form">
      <p>“{category?.name}” is deleted from this device. Its games stay.</p>
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
  .foot { display: flex; gap: var(--s-2); }
  .foot > :global(*) { flex: 1 1 0; }
</style>
