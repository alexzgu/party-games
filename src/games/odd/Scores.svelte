<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Board from './Board.svelte';
  import { roundPoints, type GameState } from './logic';

  // Between rounds: the round's points beside the standings, then the next round.
  let { game, error = '', onnext, onleave }: { game: GameState; error?: string; onnext: () => void; onleave: () => void } = $props();
  const gained = $derived(roundPoints(game.round, game.players.length));
</script>

<Screen title={gameName('odd')} onback={onleave} backLabel="Back to setup">
  <div class="scores">
    <p class="kicker">After round {game.log.length} of {game.rounds}</p>
    <p class="recap">{game.players[game.round.odd].name} was the odd one out · the word was <b>{game.round.word}</b></p>
    <Board {game} {gained} />
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>

  {#snippet actions()}
    <Button size="lg" onclick={onnext}>Next round</Button>
  {/snippet}
</Screen>

<style>
  .scores { display: flex; flex-direction: column; gap: var(--s-3); padding-top: var(--s-2); }
  .kicker { text-align: center; color: var(--text-dim); font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.85rem; }
  .recap { text-align: center; color: var(--text-dim); font-weight: 600; overflow-wrap: anywhere; }
  .recap b { color: var(--text); }
  .error { color: var(--bad-ink); text-align: center; }
</style>
