<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Scoreboard from './Scoreboard.svelte';
  import type { GameState } from './logic';

  // Between songs: the standings, and the next song loading behind them.
  let { game, loading, onnext, onleave }: { game: GameState; loading: boolean; onnext: () => void; onleave: () => void } = $props();
  const flash = $derived(game.outcome?.kind === 'point' ? game.outcome.scorer : -1);
  const gained = $derived(game.outcome?.kind === 'point' ? game.outcome.points : 0);
</script>

<Screen title={gameName('song')} onback={onleave} backLabel="Back to setup">
  <div class="head">
    <h2 class="pop-in">Scores</h2>
    <p class="meta">After {game.songsPlayed} {game.songsPlayed === 1 ? 'song' : 'songs'} · first to {game.target} wins</p>
  </div>
  <Scoreboard {game} {flash} {gained} />

  {#snippet actions()}
    <Button size="lg" onclick={onnext}>Next song →</Button>
    {#if loading}<p class="loading" role="status">Loading the next song…</p>{/if}
  {/snippet}
</Screen>

<style>
  .head { text-align: center; display: flex; flex-direction: column; gap: var(--s-1); }
  h2 { font-size: 2.4rem; }
  .meta { color: var(--text-dim); }
  .loading { text-align: center; color: var(--text-faint); font-size: 0.9rem; }
</style>
