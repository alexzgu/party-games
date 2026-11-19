<script lang="ts">
  // Big Board entry. Sub-routes: #/quiz (setup) and #/quiz/play (board, clue, win). Using the
  // hash means a reload lands on the same screen; the saved game puts it in the same state.
  import { route, go } from '../../lib/router.svelte';
  import Setup from './Setup.svelte';
  import Play from './Play.svelte';
  import { loadGame, saveGame } from './store';
  import { endedRecord, newGame, type Game, type Options } from './logic';
  import { record } from '../../lib/history';
  import { demoGame } from './demo';

  const demo = route.params.get('demo') ?? '';
  let game = $state.raw<Game | null>(demo ? demoGame(demo) : loadGame());
  const sub = $derived(demo ? (game ? 'play' : '') : (route.path.split('/').filter(Boolean)[1] ?? ''));

  function commit(next: Game | null) {
    game = next;
    if (!demo) saveGame(next);
  }

  function start(o: Options) {
    // Starting over throws away a game still in play: keep it in History as ended early.
    const ended = !demo && game ? endedRecord(game) : null;
    if (ended) record(ended);
    commit(newGame(o));
    go('/quiz/play', true);
  }

  // A stale or missing game on the play route falls back to setup.
  $effect(() => {
    if (sub === 'play' && !game) go('/quiz', true);
  });
</script>

<div class="big-board">
  {#if sub === 'play' && game}
    <Play
      {game}
      {commit}
      {demo}
      onleave={() => go('/quiz', true)}
      onnew={() => { commit(null); go('/quiz', true); }}
      onhome={() => { commit(null); go('/', true); }}
    />
  {:else}
    <Setup saved={game} onstart={start} onresume={() => go('/quiz/play', true)} onhome={() => go('/', true)} />
  {/if}
</div>

<style>
  .big-board { --accent: var(--c-quiz); display: contents; }
</style>
