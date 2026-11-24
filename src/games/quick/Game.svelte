<script lang="ts">
  // Brain Freeze entry. Sub-routes: #/quick (setup), #/quick/play, #/quick/make,
  // #/quick/pack?id=<pack> (see and edit one pack). Using the hash means a reload lands on the
  // same screen. Setup and play replace each other in history, so the phone's back gesture from
  // either goes home; Make and the pack editor are pushed on top. ?demo=<screen> shows a fixed
  // state for screenshots and is never saved.
  import { route, go, back, backHome } from '../../lib/router.svelte';
  import Setup from './Setup.svelte';
  import Play from './Play.svelte';
  import Make from './Make.svelte';
  import PackEditor from './PackEditor.svelte';
  import { loadGame, saveGame, loadSetup, saveSetup } from './store';
  import { endedRecord, newGame, reseat, type GameOptions, type GameState } from './logic';
  import { packNames } from './deal';
  import { record } from '../../lib/history';
  import { demoGame, DEMO_PROMPTS } from './demo';

  const demo = route.params.get('demo') ?? '';
  let game = $state<GameState | null>(demo ? demoGame(demo) : loadGame());
  const sub = $derived(demo ? (demo.startsWith('make') ? 'make' : game ? 'play' : '') : (route.path.split('/').filter(Boolean)[1] ?? ''));

  function commit(next: GameState | null) {
    game = next;
    if (!demo) saveGame(next);
  }

  function start(names: string[], opts: GameOptions) {
    // Starting over throws away a game nobody won yet: keep it in History as ended early.
    const ended = !demo && game ? endedRecord(game, packNames(game.packIds)) : null;
    if (ended) record(ended);
    commit(newGame(names, opts));
    go('/quick/play', true);
  }

  function packSaved(id: string) {
    const prefs = loadSetup();
    saveSetup({ ...prefs, packIds: [id] }); // a new pack is played on its own
    back('/quick');
  }

  // A stale or missing game on the play route falls back to setup.
  $effect(() => {
    if (sub === 'play' && !game) go('/quick', true);
  });
</script>

<div class="brain-freeze">
  {#if sub === 'play' && game}
    <Play {game} {commit} {demo} onleave={() => go('/quick', true)} onhome={backHome} />
  {:else if sub === 'pack'}
    <PackEditor id={route.params.get('id') ?? ''} onback={() => back('/quick')} />
  {:else if sub === 'make'}
    <Make onsaved={packSaved} onback={() => back('/quick')} demoItems={demo === 'make-review' ? DEMO_PROMPTS : null} />
  {:else}
    <Setup saved={game} onstart={start} onroster={(r) => game && commit(reseat(game, r))} onresume={() => go('/quick/play', true)} onmake={() => go('/quick/make')} onedit={(id) => go(`/quick/pack?id=${encodeURIComponent(id)}`)} onhome={() => back('/games')} />
  {/if}
</div>

<style>
  .brain-freeze { --accent: var(--c-quick); display: contents; }
</style>
