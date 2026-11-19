<script lang="ts">
  // Big Board entry. Sub-routes: #/quiz (setup), #/quiz/play (board, clue, win), #/quiz/make
  // (make a board), #/quiz/board?id=<board> (see and edit one board) and #/quiz/board?new=1 (the
  // board just made, not saved yet). Using the hash means a reload lands on the same screen; the
  // saved game (or board in the making) puts it in the same state.
  import { route, go, back } from '../../lib/router.svelte';
  import Setup from './Setup.svelte';
  import Play from './Play.svelte';
  import MakeBoard from './MakeBoard.svelte';
  import BoardEditor from './BoardEditor.svelte';
  import { loadGame, saveGame } from './store';
  import { endedRecord, newGame, type Game, type Options } from './logic';
  import { record } from '../../lib/history';
  import { demoGame } from './demo';

  const demo = route.params.get('demo') ?? '';
  const demoTeams = Number(route.params.get('teams')) || 3;
  let game = $state.raw<Game | null>(demo ? demoGame(demo, demoTeams) : loadGame());
  const sub = $derived(demo ? (game ? 'play' : '') : (route.path.split('/').filter(Boolean)[1] ?? ''));
  /** What the paste step skipped, for the editor to show once. */
  let note = $state('');

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
  {:else if sub === 'make'}
    <MakeBoard
      onmade={(_, n) => { note = n; go('/quiz/board?new=1', true); }}
      onresume={() => { note = ''; go('/quiz/board?new=1', true); }}
      onback={() => back('/quiz')}
    />
  {:else if sub === 'board'}
    {#key route.params.toString()}
      <BoardEditor
        id={route.params.get('new') ? null : (route.params.get('id') ?? '')}
        {note}
        onback={() => { note = ''; back('/quiz'); }}
        onsaved={() => { note = ''; back('/quiz'); }}
      />
    {/key}
  {:else}
    <Setup
      saved={game}
      onstart={start}
      onresume={() => go('/quiz/play', true)}
      onhome={() => go('/', true)}
      onedit={(id) => go(`/quiz/board?id=${encodeURIComponent(id)}`)}
      onmake={() => go('/quiz/make')}
    />
  {/if}
</div>

<style>
  .big-board { --accent: var(--c-quiz); display: contents; }
</style>
