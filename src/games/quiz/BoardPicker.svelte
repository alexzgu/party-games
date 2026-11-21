<script lang="ts">
  import ListTools from '../../components/ListTools.svelte';
  import PackFile from '../../components/PackFile.svelte';
  import { customQuiz, type QuizBoard } from '../../lib/content';
  import type { SortKey } from '../../lib/listing';
  import { sfx } from '../../lib/sound';
  import { boardSize, findBoards } from './find';
  import { emptyTiles } from './board';

  // Pick one board. Search and sort only change what is shown; the pick stays even when hidden.
  // The pencil on a row opens that board in the editor; "Make a pack" sits at the end.
  let { boards, selected = $bindable(), onedit, onmake, onimported }: {
    boards: QuizBoard[];
    selected: string | null;
    onedit: (id: string) => void;
    onmake: () => void;
    /** After an import: the parent reloads `boards`. */
    onimported: () => void;
  } = $props();

  let query = $state('');
  let sort = $state<SortKey>('suggested');
  const shown = $derived(findBoards(boards, query, sort));
  const tag = (b: QuizBoard) => (b.custom ? ' · Mine' : customQuiz.isEdited(b.id) ? ' · Edited' : '');
  const empty = (b: QuizBoard) => emptyTiles(b).length;

  /** The first imported pack is picked, like a pack just made. */
  function imported(ids: string[]) {
    if (ids[0]) selected = ids[0];
    onimported();
  }

  function pick(id: string) {
    selected = id;
    sfx.tap();
  }
</script>

<section class="boards" aria-labelledby="boards-h">
  <ListTools key="quiz:boards" bind:query bind:sort placeholder="Search packs and clues" shown={shown.length} total={boards.length}>
    {#snippet title()}<h3 id="boards-h">Pack</h3>{/snippet}
  </ListTools>
  {#if query && !shown.length}<p class="none">No packs match “{query.trim()}”</p>{/if}
  <ul role="radiogroup" aria-labelledby="boards-h">
    {#each shown as { b, hit } (b.id)}
      {@const on = selected === b.id}
      {@const gaps = empty(b)}
      <li>
        <button class="row" class:on role="radio" aria-checked={on} onclick={() => pick(b.id)}>
          <span class="radio" aria-hidden="true">{on ? '✓' : ''}</span>
          <span class="txt">
            <span class="name">{b.name}</span>
            <span class="blurb">{b.blurb}</span>
            {#if hit}<span class="hit">{hit}</span>{/if}
            <span class="cats">{b.categories.map((c) => c.name).join(' · ')}</span>
            <span class="size">{boardSize(b)}{tag(b)}{#if gaps}<span class="gaps">{` · ${gaps} empty`}</span>{/if}</span>
          </span>
        </button>
        <button class="edit" onclick={() => onedit(b.id)} aria-label="See and edit {b.name}">
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg>
        </button>
      </li>
    {/each}
    <li>
      <button class="row make" onclick={onmake}>
        <span class="spark" aria-hidden="true">✨</span>
        <span class="txt">
          <span class="name">Make a pack</span>
          <span class="blurb">Start blank, paste one, or ask the wizard</span>
        </span>
      </button>
    </li>
  </ul>
  <PackFile game="quiz" onimported={imported} />
</section>

<style>
  .boards { display: flex; flex-direction: column; }
  .none { margin: 0 0 var(--s-3); color: var(--text-dim); }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  li { position: relative; }
  .row {
    width: 100%; display: flex; align-items: flex-start; gap: var(--s-3); text-align: left;
    padding: var(--s-3) 56px var(--s-3) var(--s-3); border-radius: var(--r-md);
    border: 2px solid var(--line); background: var(--surface);
    transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast) ease, background var(--dur-fast) ease;
  }
  .row:active { transform: scale(0.98); }
  .row.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, var(--surface)); }
  .radio {
    flex: none; width: 26px; height: 26px; margin-top: 2px; border-radius: 50%; border: 2px solid var(--line-strong);
    display: grid; place-items: center; font-weight: 900; font-size: 0.9rem;
  }
  .row.on .radio { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
  .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .name { font-family: var(--font-display); font-weight: 800; font-size: 1.15rem; line-height: 1.15; }
  .blurb { color: var(--text-dim); font-size: 0.88rem; line-height: 1.3; }
  .hit { color: var(--text-faint); font-size: 0.8rem; font-style: italic; overflow-wrap: anywhere; }
  .cats { color: var(--text-faint); font-size: 0.78rem; line-height: 1.3; margin-top: 2px; }
  .size { color: var(--text-faint); font-size: 0.8rem; font-weight: 700; font-variant-numeric: tabular-nums; }
  .gaps { color: var(--c-pass); }
  .make { border-style: dashed; border-color: color-mix(in srgb, var(--accent) 55%, transparent); background: transparent; padding-right: var(--s-3); }
  .spark { flex: none; width: 26px; font-size: 1.3rem; text-align: center; }
  /* 48px to tap, drawn as a smaller circle so it reads as part of the row */
  .edit {
    position: absolute; top: 50%; right: 4px; translate: 0 -50%; width: 48px; height: 48px; padding: 0;
    border: 0; background: transparent; color: var(--text-dim); display: grid; place-items: center;
  }
  .edit::before {
    content: ''; position: absolute; inset: 6px; border-radius: 50%;
    background: var(--overlay); border: 1.5px solid var(--line-strong);
  }
  .edit svg { position: relative; }
  .edit:active::before { background: color-mix(in srgb, var(--accent) 30%, var(--surface)); }
</style>
