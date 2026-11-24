<script lang="ts">
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Confetti from './Confetti.svelte';
  import Board from './Board.svelte';
  import { playerColor } from './ui';
  import { joinNames, leaders, type GameState } from './logic';

  // Game over: the top score (several names on a tie), the standings, and Play again with the
  // same players, packs and options.
  let { game, error = '', onagain, onsetup, onhome }: { game: GameState; error?: string; onagain: () => void; onsetup: () => void; onhome: () => void } = $props();
  const top = $derived(leaders(game));
  const best = $derived(game.players[top[0]].score);
</script>

<Confetti count={70} />

<Screen title="Game over" onback={onhome} backLabel="Home">
  <div class="champ" style:--c={playerColor(top[0])}>
    <span class="trophy pop-in" aria-hidden="true">🏆</span>
    <p class="name pop-in">{joinNames(top.map((i) => game.players[i].name))}</p>
    <p class="wins">{top.length > 1 ? 'tie' : 'wins'} with {best} {best === 1 ? 'point' : 'points'} after {game.rounds} rounds</p>
  </div>
  <Board {game} {top} />
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  {#snippet actions()}
    <Button size="lg" onclick={onagain} tip="Same players, packs and options, scores back to zero">Play again</Button>
    <Button variant="secondary" onclick={onsetup}>Setup</Button>
    <Button variant="ghost" size="sm" onclick={onhome}>Home</Button>
  {/snippet}
</Screen>

<style>
  .champ { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--s-2); padding: var(--s-4) 0 var(--s-4); }
  .trophy { font-size: 4.5rem; line-height: 1; filter: drop-shadow(0 10px 30px color-mix(in srgb, var(--c-gold) calc(50% * var(--glow)), transparent)); }
  .name { font-family: var(--font-display); font-weight: 800; font-size: clamp(2.2rem, 13vw, 4rem); line-height: 1.02; color: var(--c); letter-spacing: -0.03em; overflow-wrap: anywhere; animation-delay: 120ms; }
  .wins { color: var(--text-dim); font-size: 1.05rem; }
  .error { color: var(--bad-ink); text-align: center; margin-top: var(--s-3); }
</style>
