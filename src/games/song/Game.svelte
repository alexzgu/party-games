<script lang="ts">
  // Earworm entry. Sub-routes: #/song (setup), #/song/play, #/song/pack?id=<pack> (see and edit
  // one pack). Setup and play replace each other in history, so the back gesture from either
  // goes home; the pack editor is pushed on top.
  import { route, go, back } from '../../lib/router.svelte';
  import Setup from './Setup.svelte';
  import Play from './Play.svelte';
  import PackEditor from './PackEditor.svelte';
  import { loadGame, saveGame, loadSetup, saveSetup, loadBroken } from './store';
  import { endedRecord, newGame, type GameOptions, type GameState } from './logic';
  import { makeDealer, packNames } from './deal';
  import { record } from '../../lib/history';
  import { customSongs } from '../../lib/content';
  import { demoGame } from './demo';

  const demo = route.params.get('demo') ?? '';
  const shown = demo ? demoGame(demo) : null;
  let game = $state<GameState | null>(shown ? shown.game : loadGame());
  const sub = $derived(demo ? (game ? 'play' : '') : (route.path.split('/').filter(Boolean)[1] ?? ''));

  function commit(next: GameState | null) {
    game = next;
    if (!demo) saveGame(next);
  }

  function start(names: string[], opts: GameOptions) {
    // Starting over throws away a game nobody won yet: keep it in History as ended early.
    const ended = !demo && game ? endedRecord(game, packNames(game.packIds)) : null;
    if (ended) record(ended);
    commit(newGame(names, opts, makeDealer(opts.packIds, loadBroken()).next()));
    go('/song/play', true);
  }

  /** A new, empty pack of the player's own, opened in the editor and ticked for play. */
  function newPack() {
    const id = 'my-songs-' + Date.now().toString(36);
    customSongs.put({ id, name: 'My songs', blurb: 'Made on this phone', songs: [] });
    const prefs = loadSetup();
    saveSetup({ ...prefs, packIds: [...new Set([...(prefs.packIds ?? []), id])] });
    go(`/song/pack?id=${encodeURIComponent(id)}`);
  }

  // A stale or missing game on the play route falls back to setup.
  $effect(() => {
    if (sub === 'play' && !game) go('/song', true);
  });
</script>

<div class="earworm">
  {#if sub === 'play' && game}
    <Play {game} {commit} {demo} demoStatus={shown?.status} onleave={() => go('/song', true)} onhome={() => go('/', true)} />
  {:else if sub === 'pack'}
    <PackEditor id={route.params.get('id') ?? ''} onback={() => back('/song')} />
  {:else}
    <Setup saved={game} onstart={start} onresume={() => go('/song/play', true)} onnew={newPack} onedit={(id) => go(`/song/pack?id=${encodeURIComponent(id)}`)} onhome={() => go('/', true)} />
  {/if}
</div>

<style>
  .earworm { --accent: var(--c-song); display: contents; }
</style>
