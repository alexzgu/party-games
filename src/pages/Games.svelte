<script lang="ts">
  import Screen from '../components/Screen.svelte';
  import Segmented from '../components/Segmented.svelte';
  import Button from '../components/Button.svelte';
  import GameCard from '../components/GameCard.svelte';
  import CategoryEditor from '../components/CategoryEditor.svelte';
  import { GAMES, type GameId } from '../app.config';
  import { ALL, categories, clearFilters, PLAYERS_MAX, shownGames, togglePick, type GamesState, type Order } from '../lib/gamesView';
  import { gamesPage, noteOpened, openedForOrder, setGamesPage } from '../lib/gamesPage.svelte';
  import { back, go } from '../lib/router.svelte';
  import { unlockAudio, sfx } from '../lib/sound';
  import { haptic } from '../lib/haptics';

  // Every game (#/games), opened from the main menu: in the order chosen, narrowed by categories
  // (several picked: a game in every one) and by how many are playing. The choices stay on this
  // phone (lib/gamesPage.svelte.ts), not in the address. A game's first screen comes Back here.
  const ORDERS: { value: Order; label: string; tip?: string }[] = [
    { value: 'default', label: 'Default' },
    { value: 'az', label: 'A–Z' },
    { value: 'recent', label: 'Recent', tip: 'Games opened last on this device first' },
  ];
  const PLAYERS = Array.from({ length: PLAYERS_MAX }, (_, i) => i + 1);

  const cats = $derived(categories(gamesPage.own));
  // Recent goes by the times the page was opened with (lib/gamesPage.svelte.ts).
  const shown = $derived(shownGames(gamesPage, GAMES, openedForOrder()));
  let editing = $state(false);

  const change = (next: GamesState) => setGamesPage(next);
  const set = (patch: Partial<GamesState>) => change({ ...$state.snapshot(gamesPage), ...patch });

  function pick(id: string | null) {
    sfx.tick();
    haptic.light();
    change(id ? togglePick($state.snapshot(gamesPage), id) : { ...$state.snapshot(gamesPage), picked: [] });
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

  <!-- Pinned under the header: the players filter, then the categories, sideways when they overflow. -->
  <div class="filters pinned-bg">
    <select class="players" class:on={gamesPage.players !== null} aria-label="Players" bind:value={() => gamesPage.players ?? 0, (n) => set({ players: +n || null })} data-tip="Only games that fit this many players">
      <option value={0}>Any players</option>
      {#each PLAYERS as n (n)}<option value={n}>{n} player{n === 1 ? '' : 's'}</option>{/each}
    </select>
    <div class="chips" role="group" aria-label="Categories">
      <button class="chip" aria-pressed={!gamesPage.picked.length} onclick={() => pick(null)}>{ALL}</button>
      {#each cats as c (c.id)}
        <button class="chip" class:own={c.own} aria-pressed={gamesPage.picked.includes(c.id)} onclick={() => pick(c.id)}>{c.name}</button>
      {/each}
      <button class="chip edit" onclick={() => (editing = true)} data-tip="Make, rename or delete your own categories">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/></svg>
        Edit
      </button>
    </div>
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
      <Button variant="secondary" size="sm" onclick={() => change(clearFilters($state.snapshot(gamesPage)))} tip="Shows every game again">Clear</Button>
    </div>
  {/if}
</Screen>

{#if editing}<CategoryEditor onclose={() => (editing = false)} />{/if}

<style>
  /* Edge to edge; the categories scroll sideways between the players filter and the screen's edge. */
  .filters {
    position: sticky; top: var(--screen-head); z-index: var(--z-pinned); display: flex; align-items: center; gap: 6px;
    margin: calc(-1 * var(--s-2)) calc(-1 * var(--gutter-r)) 0 calc(-1 * var(--gutter-l));
    padding: var(--s-2) 0 var(--s-2) var(--gutter-l);
  }
  .players {
    flex: none; width: auto; min-height: 44px; padding: 0 var(--s-1) 0 var(--s-3); border-radius: var(--r-pill);
    color: var(--text); font-weight: 700; font-size: 0.92rem;
  }
  .players.on { border-color: var(--accent); }
  .chips {
    flex: 1; min-width: 0; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; overscroll-behavior-x: contain;
    padding: 2px var(--gutter-r) 2px 0;
  }
  .chips::-webkit-scrollbar { display: none; }
  .chip {
    flex: none; min-height: 44px; padding: 0 var(--s-3); border-radius: var(--r-pill); display: flex; align-items: center; gap: 6px;
    border: 1.5px solid var(--line-strong); background: var(--surface); color: var(--text); font-weight: 700; white-space: nowrap;
    transition: transform var(--dur-fast) var(--ease-out);
  }
  .chip:active { transform: scale(0.96); }
  .chip.own { border-style: dashed; }
  .chip[aria-pressed='true'] { border-color: var(--accent); border-style: solid; background: var(--accent); color: var(--on-accent); }
  .chip.edit { background: transparent; color: var(--text-dim); border-style: dashed; }
  .list { display: flex; flex-direction: column; gap: var(--s-3); }
  .none { display: flex; flex-direction: column; align-items: flex-start; gap: var(--s-2); }
  .none p { margin: 0; color: var(--text-dim); font-weight: 600; }
</style>
