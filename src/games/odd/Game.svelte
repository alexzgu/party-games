<script lang="ts">
  // Odd One Out entry. Sub-routes: #/odd (setup), #/odd/play. Setup and play replace each other
  // in history, so the phone's back gesture from either goes back to the Games page. ?demo=<screen>
  // shows a fixed state for screenshots and is never saved.
  import { route, go, back, backHome } from '../../lib/router.svelte';
  import Setup from './Setup.svelte';
  import Play from './Play.svelte';
  import { loadGame, saveGame } from './store';
  import { endedRecord, newGame, type GameOptions, type GameState } from './logic';
  import { makeDealer, packNames, pickedDecks } from './deal';
  import { record } from '../../lib/history';
  import { demoGame } from './demo';

  const demo = route.params.get('demo') ?? '';
  let game = $state<GameState | null>(demo ? demoGame(demo) : loadGame());
  const sub = $derived(demo ? (game ? 'play' : '') : (route.path.split('/').filter(Boolean)[1] ?? ''));

  function commit(next: GameState | null) {
    game = next;
    if (!demo) saveGame(next);
  }

  function start(names: string[], opts: GameOptions) {
    // Starting over throws away a game nobody finished: keep it in History as ended early.
    const ended = !demo && game ? endedRecord(game, packNames(game.packIds)) : null;
    if (ended) record(ended);
    const secret = makeDealer(pickedDecks(opts.packIds))();
    if (!secret) return;
    commit(newGame(names, opts, secret));
    go('/odd/play', true);
  }

  // A stale or missing game on the play route falls back to setup.
  $effect(() => {
    if (sub === 'play' && !game) go('/odd', true);
  });
</script>

<div class="odd-one-out">
  {#if sub === 'play' && game}
    <Play {game} {commit} {demo} onleave={() => go('/odd', true)} onhome={backHome} />
  {:else}
    <Setup saved={game} onstart={start} onresume={() => go('/odd/play', true)} onhome={() => back('/games')} />
  {/if}
</div>

<style>
  .odd-one-out { --accent: var(--c-odd); display: contents; }
</style>
