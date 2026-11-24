<script lang="ts">
  import { GAMES, type PackGameId } from '../app.config';
  import Community from '../components/Community.svelte';
  import GamePicker from '../components/GamePicker.svelte';
  import { communityGames, tabOf, viewUrl } from '../lib/communityView';
  import { back, route, swap } from '../lib/router.svelte';

  // The Community page (#/community/<game>), opened from the main menu: the Community packs of
  // every game in the library, the game chosen in a searchable box pinned under the header. The
  // game, like the search and the order, changes the address in place, so Back leaves for the
  // main menu; an import comes back here, as it was, with a note (Community's `stay`).
  const games = communityGames();
  const options = games.map((id) => GAMES.find((g) => g.id === id)!);
  const game = $derived(tabOf(route.path, games) as PackGameId);

  function pick(id: string) {
    if (id === game) return;
    swap(viewUrl(`/community/${id}`, route.params, { pack: null })); // Community starts its list from the top
  }
</script>

<Community {game} stay onclose={() => back('/')} closeLabel="Back to the main menu" onimport={() => {}}>
  {#snippet head()}
    <div class="pick"><GamePicker {options} value={game} label="Game" onpick={pick} /></div>
  {/snippet}
</Community>

<style>
  .pick { padding-bottom: var(--s-2); }
</style>
