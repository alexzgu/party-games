<script lang="ts">
  // Say What? entry. Sub-routes: #/gibberish (setup), #/gibberish/play, #/gibberish/make.
  // Using the hash means a reload lands on the same screen. Setup and play replace each other
  // in history, so the phone's back gesture from either goes home; Make is pushed on top.
  import { route, go, back } from '../../lib/router.svelte';
  import Setup from './Setup.svelte';
  import Play from './Play.svelte';
  import Make from './Make.svelte';
  import { loadGame, saveGame, loadSetup, saveSetup } from './store';
  import { newGame, type GameOptions, type GameState } from './logic';
  import { demoGame, DEMO_CARDS } from './demo';

  const demo = route.params.get('demo') ?? '';
  let game = $state<GameState | null>(demo ? demoGame(demo) : loadGame());
  const sub = $derived(demo ? (demo.startsWith('make') ? 'make' : game ? 'play' : '') : (route.path.split('/').filter(Boolean)[1] ?? ''));

  function commit(next: GameState | null) {
    game = next;
    if (!demo) saveGame(next);
  }

  function start(names: string[], opts: GameOptions) {
    commit(newGame(names, opts));
    go('/gibberish/play', true);
  }

  function packSaved(id: string) {
    const prefs = loadSetup();
    saveSetup({ ...prefs, packIds: [...new Set([...(prefs.packIds ?? []), id])] });
    back('/gibberish');
  }

  // A stale or missing game on the play route falls back to setup.
  $effect(() => {
    if (sub === 'play' && !game) go('/gibberish', true);
  });
</script>

<div class="say-what">
  {#if sub === 'play' && game}
    <Play {game} {commit} {demo} onleave={() => go('/gibberish', true)} onhome={() => go('/', true)} />
  {:else if sub === 'make'}
    <Make
      onsaved={packSaved}
      onback={() => back('/gibberish')}
      demoItems={demo === 'make-review' ? DEMO_CARDS : null}
      demoNoKey={demo === 'make-nokey'}
    />
  {:else}
    <Setup saved={game} onstart={start} onresume={() => go('/gibberish/play', true)} onmake={() => go('/gibberish/make')} onhome={() => go('/', true)} />
  {/if}
</div>

<style>
  .say-what { --accent: var(--c-gibberish); display: contents; }
</style>
