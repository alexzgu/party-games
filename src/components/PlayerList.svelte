<script lang="ts">
  import type { Snippet } from 'svelte';
  import { nextPlayerName } from '../lib/players';
  import { sfx } from '../lib/sound';
  import ScrollWindow from './ScrollWindow.svelte';

  // The player list on a game's setup screen (Big Board: its teams, `noun` "team"). Add makes a
  // tile named "Player N" (or `newName`'s pick);
  // tapping a tile's name (the pencil) renames it in place: Enter or leaving the box keeps it, Escape cancels.
  // `seats`, when bound, follows each tile's first place in the list (-1 for a tile added here),
  // so a saved game can tell a renamed player from a new one. The tiles show in a window about three
  // rows tall that scrolls on its own (a new player scrolls it to the end); Add player stays under it.
  type Check = (raw: string, existing: string[]) => { name: string; error: string };
  let {
    names = $bindable(), seats = $bindable([]), min, max, check, avatar,
    noun = 'player', nouns = 'players', newName = nextPlayerName, tally = String, keep = 0, full, note,
  }: {
    names: string[]; seats?: number[]; min: number; max: number; check: Check; avatar: Snippet<[string, number]>;
    /** What a tile is, one and many: "Add team", "10 teams is the most", the heading "Teams". */
    noun?: string; nouns?: string;
    /** The name a new tile gets. */
    newName?: (names: string[]) => string;
    /** The count in the head ("3"; Big Board: "Solo" for one). */
    tally?: (n: number) => string;
    /** ✕ shows only while there are more tiles than this. */
    keep?: number;
    /** The Add button's words at `max`, when not "N players is the most". */
    full?: string;
    /** Shown under the head. */
    note?: Snippet;
  } = $props();
  const heading = $derived(nouns[0].toUpperCase() + nouns.slice(1));
  let tiles: ScrollWindow | undefined = $state();
  let editing = $state(-1);
  let draft = $state('');
  let error = $state('');

  function add() {
    editing = -1;
    names = [...names, newName(names)];
    seats = [...seats, -1];
    error = '';
    sfx.tap();
    void tiles?.toEnd();
  }

  function removeAt(i: number) {
    names = names.filter((_, k) => k !== i);
    seats = seats.filter((_, k) => k !== i);
    error = '';
  }

  function startRename(i: number) {
    editing = i;
    draft = names[i];
    error = '';
  }

  /** Keeps a valid new name. A bad one shows why; Enter leaves the box open to fix it, leaving the box keeps the old name. */
  function commit(i: number, stayOnError: boolean) {
    if (editing !== i) return;
    const others = names.filter((_, k) => k !== i);
    const { name, error: why } = check(draft, others);
    if (name && why) {
      error = why;
      if (stayOnError) return;
    } else if (name && name !== names[i]) {
      names = names.map((n, k) => (k === i ? name : n));
    }
    editing = -1;
  }

  function onkey(e: KeyboardEvent, i: number) {
    if (e.key === 'Enter') { e.preventDefault(); commit(i, true); }
    if (e.key === 'Escape') { e.preventDefault(); editing = -1; error = ''; }
  }

  function focusAll(input: HTMLInputElement) {
    input.focus();
    input.select();
  }
</script>

<section class="players" aria-labelledby="{nouns}-h">
  <div class="head">
    <h3 id="{nouns}-h">{heading}</h3>
    <span class="count" class:short={names.length < min}>{tally(names.length)} {#if names.length < min}· need {min}+{/if}</span>
  </div>
  {@render note?.()}
  {#if names.length}
    <ScrollWindow bind:this={tiles}>
    <ul class="list">
      {#each names as name, i (name)}
        <li class="pop-in" class:fixed={names.length <= keep}>
          {@render avatar(name, i)}
          {#if editing === i}
            <input
              {@attach focusAll}
              bind:value={draft}
              type="text"
              aria-label="New name for {name}"
              autocomplete="off" autocapitalize="words" enterkeyhint="done" maxlength="18"
              oninput={() => (error = '')}
              onkeydown={(e) => onkey(e, i)}
              onblur={() => commit(i, false)}
            />
          {:else}
            <button class="name" onclick={() => startRename(i)} aria-label="Rename {name}" data-tip="Rename {name}">
              <span>{name}</span>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg>
            </button>
            {#if names.length > keep}
              <button class="x" onclick={() => removeAt(i)} aria-label="Remove {name}">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>
              </button>
            {/if}
          {/if}
        </li>
      {/each}
    </ul>
    </ScrollWindow>
  {/if}
  <button class="add" onclick={add} disabled={names.length >= max} data-tip={names.length >= max ? undefined : `Adds another ${noun}; click the name to change it`}>
    {names.length >= max ? (full ?? `${max} ${nouns} is the most`) : `Add ${noun}`}
  </button>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
  .players { display: flex; flex-direction: column; gap: var(--s-2); }
  .head { display: flex; align-items: baseline; justify-content: space-between; }
  .count { color: var(--text-faint); font-weight: 600; font-size: 0.9rem; }
  .count.short { color: var(--c-pass); }
  .list { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s-2); }
  li { display: flex; align-items: center; gap: var(--s-1); padding: 4px 0 4px 8px; border-radius: var(--r-md); background: var(--surface); min-height: 52px; }
  li.fixed { padding-right: 8px; }
  .name { flex: 1; min-width: 0; min-height: 44px; display: flex; align-items: center; gap: var(--s-1); padding: 0 0 0 var(--s-1);
    border: 0; border-radius: var(--r-sm); background: transparent; color: inherit; font: inherit; font-weight: 700; text-align: left; }
  /* Up to two lines, so "Player 12" keeps its number in a half-width tile. */
  .name span { min-width: 0; overflow: hidden; overflow-wrap: break-word; line-height: 1.15;
    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
  .name svg { flex: none; color: var(--text-faint); }
  /* A narrow tile (half of a small phone) gives the name the pencil's room, so "Player 3" stays whole. */
  li { container-type: inline-size; }
  @container (max-width: 200px) {
    .name svg { display: none; }
    .name span { font-size: 0.95rem; hyphens: auto; }
  }
  .name:active { background: var(--surface-hi); }
  input { flex: 1; min-width: 0; min-height: 44px; margin-right: 6px; padding: 0 var(--s-2); font-weight: 700; border-radius: var(--r-sm); }
  .x { width: 44px; height: 44px; flex: none; border: 0; border-radius: var(--r-pill); background: transparent; color: var(--text-faint); display: grid; place-items: center; }
  .x:active { background: var(--surface-hi); }
  .add { min-height: 52px; border-radius: var(--r-md); border: 0; background: var(--accent); color: var(--on-accent); font-weight: 800; font-family: var(--font-display); font-size: 1.05rem; }
  .add:disabled { background: var(--surface); color: var(--text-faint); }
  .error { color: var(--c-pass); font-size: 0.95rem; }
</style>
