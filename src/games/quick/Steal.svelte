<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import { playerColor } from './ui';
  import type { GameState } from './logic';

  // A miss with Steal on: the next player takes the same prompt with a fresh clock.
  let { game, onbegin, onundo, onleave }: { game: GameState; onbegin: () => void; onundo: () => void; onleave: () => void } = $props();
  const thief = $derived(game.players[game.actor]);
  const owner = $derived(game.players[game.turn]);
</script>

<Screen title={gameName('quick')} onback={onleave} backLabel="Back to setup">
<div class="center" style:--c={playerColor(game.actor)}>
  <p class="missed pop-in"><span aria-hidden="true">✗</span> {owner.name} missed</p>
  <p class="steal pop-in">Steal!</p>
  <div class="hand">
    <p class="kicker">Pass the phone to</p>
    <p class="name pop-in">{thief.name}</p>
    <p class="hint">Same prompt, fresh {game.seconds} seconds. Name 3 things <b>{owner.name} didn't say</b> to take the point.</p>
  </div>
</div>

  {#snippet actions()}
    <Button size="lg" onclick={onbegin}>I'm {thief.name}, start my clock</Button>
    <Button variant="ghost" size="sm" onclick={onundo}>Wrong call? Undo</Button>
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; gap: var(--s-3); }
  .missed { color: var(--text-dim); font-weight: 700; font-size: 1.15rem; }
  .missed span { color: var(--c-bad); }
  .steal {
    font-family: var(--font-display); font-weight: 800; font-size: clamp(3rem, 20vw, 6rem); line-height: 1; letter-spacing: -0.03em;
    color: var(--c-pass);
    animation-delay: 80ms;
  }
  .hand { display: flex; flex-direction: column; align-items: center; gap: var(--s-2); margin-top: var(--s-3); }
  .kicker { color: var(--text-dim); font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.85rem; }
  .name { font-family: var(--font-display); font-weight: 800; color: var(--c); font-size: clamp(2.4rem, 14vw, 4.2rem); line-height: 1; letter-spacing: -0.03em; overflow-wrap: anywhere; animation-delay: 160ms; }
  .hint { font-size: 1.05rem; max-width: 22em; color: var(--text-dim); }
  .hint b { color: var(--text); }
</style>
