<script lang="ts">
  // Earworm entry. Sub-routes: #/song (setup), #/song/play, #/song/pack?id=<pack> (see and edit
  // one pack), #/song/add?id=<pack> (add songs to it). Setup and play replace each other in
  // history, so the back gesture from either goes home; the pack screens are pushed on top.
  import { route, go, back } from '../../lib/router.svelte';
  import Setup from './Setup.svelte';
  import Play from './Play.svelte';
  import PackEditor from './PackEditor.svelte';
  import AddSongs from './AddSongs.svelte';
  import { loadGame, saveGame, loadSetup, saveSetup, loadRawGame, dropGame } from './store';
  import { endedRecord, newGame, retiredRecord, type GameOptions, type GameState } from './logic';
  import { makeDealer, packNames } from './deal';
  import { record } from '../../lib/history';
  import { customSongs } from '../../lib/content';
  import { demoGame } from './demo';

  const demo = route.params.get('demo') ?? '';
  const shown = demo ? demoGame(demo) : null;
  // A game saved by the YouTube version of Earworm cannot carry on: its scores go to History.
  const retired = demo ? '' : retireOldSave();
  let game = $state<GameState | null>(shown ? shown.game : loadGame());
  const sub = $derived(demo ? (game ? 'play' : '') : (route.path.split('/').filter(Boolean)[1] ?? ''));

  function retireOldSave(): string {
    const raw = loadRawGame() as { v?: unknown; packIds?: unknown } | null;
    if (!raw || typeof raw !== 'object' || raw.v !== 1) return '';
    const entry = retiredRecord(raw, Array.isArray(raw.packIds) ? packNames(raw.packIds.filter((x): x is string => typeof x === 'string')) : []);
    if (entry) record(entry);
    dropGame();
    return entry
      ? 'Earworm now plays songs from Apple Music, so the game saved on this phone could not carry on. Sorry! Its scores are in History.'
      : 'Earworm now plays songs from Apple Music, so the game saved on this phone could not carry on. Sorry!';
  }

  function commit(next: GameState | null) {
    game = next;
    if (!demo) saveGame(next);
  }

  function start(names: string[], opts: GameOptions) {
    // Starting over throws away a game nobody won yet: keep it in History as ended early.
    const ended = !demo && game ? endedRecord(game, packNames(game.packIds)) : null;
    if (ended) record(ended);
    commit(newGame(names, opts, makeDealer(opts.packIds).next()));
    go('/song/play', true);
  }

  /** A new, empty pack of the player's own, ticked for play, opened straight on "Add songs". */
  function newPack() {
    const id = 'my-songs-' + Date.now().toString(36);
    customSongs.put({ id, name: 'My songs', blurb: 'Made on this phone', songs: [] });
    const prefs = loadSetup();
    saveSetup({ ...prefs, packIds: [...new Set([...(prefs.packIds ?? []), id])] });
    go(`/song/pack?id=${encodeURIComponent(id)}`);
    go(`/song/add?id=${encodeURIComponent(id)}`);
  }

  const packId = $derived(route.params.get('id') ?? '');

  // A stale or missing game on the play route falls back to setup.
  $effect(() => {
    if (sub === 'play' && !game) go('/song', true);
  });
</script>

<div class="earworm">
  {#if sub === 'play' && game}
    <Play {game} {commit} {demo} demoStatus={shown?.status} demoTrack={shown?.track} onleave={() => go('/song', true)} onhome={() => go('/', true)} />
  {:else if sub === 'pack'}
    {#key packId}
      <PackEditor id={packId} onback={() => back('/song')} onadd={() => go(`/song/add?id=${encodeURIComponent(packId)}`)} />
    {/key}
  {:else if sub === 'add'}
    {#key packId}
      <AddSongs id={packId} onback={() => back(`/song/pack?id=${encodeURIComponent(packId)}`)} />
    {/key}
  {:else}
    <Setup saved={game} notice={retired} onstart={start} onresume={() => go('/song/play', true)} onnew={newPack} onedit={(id) => go(`/song/pack?id=${encodeURIComponent(id)}`)} onhome={() => go('/', true)} />
  {/if}
</div>

<style>
  .earworm { --accent: var(--c-song); display: contents; }
</style>
