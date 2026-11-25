<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Avatar from './Avatar.svelte';
  import Rules from './Rules.svelte';
  import { playerColor } from './ui';
  import { clueOrder, type GameState } from './logic';

  // Everyone has seen their secret: who starts, the order round the room, then the vote. No timer.
  let { game, onvote, onleave }: { game: GameState; onvote: () => void; onleave: () => void } = $props();
  const order = $derived(clueOrder(game));
  const starter = $derived(game.players[game.round.starter].name);
</script>

<Screen title={gameName('odd')} onback={onleave} backLabel="Back to setup">
  {#snippet trailing()}<Rules hint={game.hint} oddNeverStarts={game.oddNeverStarts} />{/snippet}
  <div class="clues">
    <p class="kicker">Round {game.log.length + 1} of {game.rounds}</p>
    <p class="start pop-in" style:--c={playerColor(game.round.starter)}><span>{starter}</span> starts</p>
    <p class="say">Take turns: say one word about the secret word.</p>
    <ol class="order" aria-label="Clue order">
      {#each order as seat, i (seat)}
        <li><span class="n">{i + 1}</span><Avatar name={game.players[seat].name} index={seat} size={28} /><span class="pname">{game.players[seat].name}</span></li>
      {/each}
    </ol>
  </div>

  {#snippet actions()}
    <Button size="lg" onclick={onvote}>Vote</Button>
  {/snippet}
</Screen>

<style>
  .clues { display: flex; flex-direction: column; align-items: center; gap: var(--s-3); text-align: center; padding-top: var(--s-2); }
  .kicker { color: var(--text-faint); font-weight: 700; font-size: 0.85rem; }
  .start { font-family: var(--font-display); font-weight: 800; font-size: clamp(2rem, calc(11vw * var(--text-scale)), 3.4rem); line-height: 1.05; overflow-wrap: anywhere; }
  .start span { color: var(--c); }
  .say { font-size: 1.15rem; font-weight: 600; max-width: 22em; }
  .order { list-style: none; margin: 0; padding: 0; width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: var(--s-1); }
  li { display: flex; align-items: center; gap: var(--s-2); min-height: 44px; padding: 4px var(--s-3); border-radius: var(--r-md); background: var(--surface); text-align: left; }
  .n { width: 1.6em; color: var(--text-faint); font-weight: 800; font-variant-numeric: tabular-nums; }
  .pname { flex: 1; min-width: 0; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
