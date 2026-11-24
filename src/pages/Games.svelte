<script lang="ts">
  import Screen from '../components/Screen.svelte';
  import Segmented from '../components/Segmented.svelte';
  import Button from '../components/Button.svelte';
  import GameCard from '../components/GameCard.svelte';
  import CategoryEditor from '../components/CategoryEditor.svelte';
  import CategoryMenu from '../components/CategoryMenu.svelte';
  import { GAMES, type GameId } from '../app.config';
  import { categories, clearFilters, shownGames, togglePick, type Category, type GamesState, type Order } from '../lib/gamesView';
  import { gamesPage, noteOpened, openedForOrder, setGamesPage } from '../lib/gamesPage.svelte';
  import { tick } from 'svelte';
  import { back, go } from '../lib/router.svelte';
  import { unlockAudio, sfx } from '../lib/sound';
  import { haptic } from '../lib/haptics';

  // Every game (#/games), opened from the main menu: in the order chosen, narrowed by categories
  // (picked in a drop-down; several picked: a game in every one). The choices stay on this
  // phone (lib/gamesPage.svelte.ts), not in the address. A game's first screen comes Back here.
  const ORDERS: { value: Order; label: string; tip?: string }[] = [
    { value: 'default', label: 'Default' },
    { value: 'az', label: 'A–Z' },
    { value: 'recent', label: 'Recent', tip: 'Games opened last on this device first' },
  ];

  const cats = $derived(categories(gamesPage.own));
  // Recent goes by the times the page was opened with (lib/gamesPage.svelte.ts).
  const shown = $derived(shownGames(gamesPage, GAMES, openedForOrder()));
  /** The category editor: open on an own category, or on a new one (null); closed when false. */
  let editing = $state<Category | null | false>(false);
  let menu: CategoryMenu | undefined = $state();

  const change = (next: GamesState) => setGamesPage(next);
  const set = (patch: Partial<GamesState>) => change({ ...$state.snapshot(gamesPage), ...patch });

  const pick = (id: string) => change(togglePick($state.snapshot(gamesPage), id));
  const clear = () => change(clearFilters($state.snapshot(gamesPage)));

  async function doneEditing() {
    editing = false;
    await tick(); // the editor's focus goes back first; when what opened it is gone, the search takes it
    menu?.refocus();
  }

  function open(id: GameId) {
    unlockAudio();
    sfx.tap();
    haptic.light();
    noteOpened(id);
    go('/' + id);
  }
</script>

<Screen title="Games" onback={() => back('/')} backLabel="Back to the main menu">
  <Segmented label="Order" options={ORDERS} bind:value={() => gamesPage.order, (order) => set({ order })} />

  <!-- Pinned under the header: the categories. -->
  <div class="filters pinned-bg">
    <CategoryMenu bind:this={menu} categories={cats} picked={gamesPage.picked} ontoggle={pick} onclear={clear} onedit={(c) => (editing = c)} />
  </div>

  {#if shown.length}
    <div class="list">
      {#each shown as g, i (g.id)}
        <GameCard emoji={g.emoji} name={g.name} sub={g.players} accent={g.accent} delay={40 + Math.min(i, 8) * 50} onclick={() => open(g.id)} />
      {/each}
    </div>
  {:else}
    <div class="none">
      <p>No games fit.</p>
      <Button variant="secondary" size="sm" onclick={clear} tip="Shows every game again">Clear</Button>
    </div>
  {/if}
</Screen>

{#if editing !== false}<CategoryEditor category={editing} onclose={doneEditing} />{/if}

<style>
  /* Edge to edge, pinned under the header. */
  .filters {
    position: sticky; top: var(--screen-head); z-index: var(--z-pinned);
    margin: calc(-1 * var(--s-2)) calc(-1 * var(--gutter-r)) 0 calc(-1 * var(--gutter-l));
    padding: var(--s-2) var(--gutter-r) var(--s-2) var(--gutter-l);
  }
  .list { display: flex; flex-direction: column; gap: var(--s-3); }
  .none { display: flex; flex-direction: column; align-items: flex-start; gap: var(--s-2); }
  .none p { margin: 0; color: var(--text-dim); font-weight: 600; }
</style>
