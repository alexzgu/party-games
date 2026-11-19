<script lang="ts">
  import ListTools from '../../components/ListTools.svelte';
  import { customQuiz, type QuizBoard } from '../../lib/content';
  import type { SortKey } from '../../lib/listing';
  import { sfx } from '../../lib/sound';
  import { boardSize, findBoards } from './find';

  // Pick one board. Search and sort only change what is shown; the pick stays even when hidden.
  let { boards, selected = $bindable() }: { boards: QuizBoard[]; selected: string | null } = $props();

  let query = $state('');
  let sort = $state<SortKey>('suggested');
  const shown = $derived(findBoards(boards, query, sort));
  const tag = (b: QuizBoard) => (b.custom ? ' · Mine' : customQuiz.isEdited(b.id) ? ' · Edited' : '');

  function pick(id: string) {
    selected = id;
    sfx.tap();
  }
</script>

<section class="boards" aria-labelledby="boards-h">
  <ListTools key="quiz:boards" bind:query bind:sort placeholder="Search boards and clues" shown={shown.length} total={boards.length}>
    {#snippet title()}<h3 id="boards-h">Board</h3>{/snippet}
  </ListTools>
  {#if query && !shown.length}<p class="none">No boards match “{query.trim()}”</p>{/if}
  <ul role="radiogroup" aria-labelledby="boards-h">
    {#each shown as { b, hit } (b.id)}
      {@const on = selected === b.id}
      <li>
        <button class="row" class:on role="radio" aria-checked={on} onclick={() => pick(b.id)}>
          <span class="radio" aria-hidden="true">{on ? '✓' : ''}</span>
          <span class="txt">
            <span class="name">{b.name}</span>
            <span class="blurb">{b.blurb}</span>
            {#if hit}<span class="hit">{hit}</span>{/if}
            <span class="cats">{b.categories.map((c) => c.name).join(' · ')}</span>
          </span>
          <span class="size">{boardSize(b)}{tag(b)}</span>
        </button>
      </li>
    {/each}
  </ul>
</section>

<style>
  .boards { display: flex; flex-direction: column; }
  .none { margin: 0 0 var(--s-3); color: var(--text-dim); }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  .row {
    width: 100%; display: flex; align-items: flex-start; gap: var(--s-3); text-align: left;
    padding: var(--s-3) var(--s-3) var(--s-3) var(--s-3); border-radius: var(--r-md);
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
  .size { flex: none; color: var(--text-faint); font-size: 0.8rem; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
</style>
