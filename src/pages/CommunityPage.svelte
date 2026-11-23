<script lang="ts">
  import { GAMES, type PackGameId } from '../app.config';
  import Community from '../components/Community.svelte';
  import { communityGames, tabOf, viewUrl } from '../lib/communityView';
  import { back, route, swap } from '../lib/router.svelte';
  import { haptic } from '../lib/haptics';
  import { sfx } from '../lib/sound';

  // The Community page (#/community/<game>), opened from the main menu: the Community packs of
  // every game in the library, one tab per game across the top (sideways-scrolling, pinned under
  // the header). A tab, like the search and the order, changes the address in place, so Back
  // leaves for the main menu; an import comes back here, as it was, with a note (Community's `stay`).
  const games = communityGames();
  const gameTabs = games.map((id) => GAMES.find((g) => g.id === id)!);
  const game = $derived(tabOf(route.path, games) as PackGameId);

  let row: HTMLElement | undefined = $state();

  function pick(id: PackGameId) {
    if (id === game) return;
    sfx.tap();
    haptic.light();
    swap(viewUrl(`/community/${id}`, route.params, { pack: null }));
    scrollTo(0, 0); // another game's list starts from its top
  }

  // The open tab stays in view in its row: on arriving, after a preview and on each switch.
  $effect(() => {
    const el = row?.querySelector<HTMLElement>(`[data-game="${game}"]`);
    if (!row || !el) return;
    row.scrollLeft = el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2;
  });

  /** Arrow keys, Home and End move between the tabs, as in any tab list. */
  function keys(e: KeyboardEvent) {
    const i = games.indexOf(game);
    const to = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? games.length - 1 : null;
    if (to === null) return;
    e.preventDefault();
    const id = games[(to + games.length) % games.length];
    pick(id);
    row?.querySelector<HTMLElement>(`[data-game="${id}"]`)?.focus();
  }
</script>

<Community {game} stay onclose={() => back('/')} closeLabel="Back to the main menu" onimport={() => {}}>
  {#snippet tabs()}
    <div class="tabs pinned-bg" role="tablist" aria-label="Games" tabindex="-1" bind:this={row} onkeydown={keys}>
      {#each gameTabs as t (t.id)}
        <button type="button" class="tab" class:on={t.id === game} style:--tab={t.accent} role="tab" data-game={t.id}
          aria-selected={t.id === game} tabindex={t.id === game ? 0 : -1} onclick={() => pick(t.id as PackGameId)}>
          <span aria-hidden="true">{t.emoji}</span><span class="tname">{t.name}</span>
        </button>
      {/each}
    </div>
  {/snippet}
</Community>

<style>
  /* Pinned under the header, edge to edge; the row scrolls sideways when the games overflow it. */
  .tabs {
    position: sticky; top: var(--screen-head); z-index: var(--z-pinned);
    display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; overscroll-behavior-x: contain;
    margin: calc(-1 * var(--s-4)) calc(-1 * var(--gutter-r)) 0 calc(-1 * var(--gutter-l));
    padding: var(--s-2) var(--gutter-r) var(--s-2) var(--gutter-l);
  }
  .tabs::-webkit-scrollbar { display: none; }
  .tabs:focus { outline: none; }
  /* Each game in its own colour: outlined, filled when open. */
  .tab {
    flex: none; min-height: 44px; padding: 0 var(--s-3); border-radius: var(--r-pill); display: flex; align-items: center; gap: 6px;
    border: 1.5px solid color-mix(in srgb, var(--tab) 55%, transparent); background: color-mix(in srgb, var(--tab) 10%, var(--surface));
    color: var(--text); font-weight: 700; white-space: nowrap;
    transition: transform var(--dur-fast) var(--ease-out);
  }
  .tab:active { transform: scale(0.96); }
  .tab.on { border-color: var(--tab); background: var(--tab); color: var(--on-accent); }
</style>
