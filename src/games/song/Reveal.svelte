<script lang="ts">
  import Button from '../../components/Button.svelte';
  import FitText from '../../components/FitText.svelte';
  import Confetti from './Confetti.svelte';
  import { playerColor } from './ui';
  import { winner, type GameState } from './logic';

  // Shown to the whole room: who got it, and the song big. The video plays on, uncovered,
  // between the banner and the title (see Play.svelte).
  let { game, onnext, onundo }: { game: GameState; onnext: () => void; onundo: () => void } = $props();

  const outcome = $derived(game.outcome!);
  const scorer = $derived(outcome.kind === 'point' ? outcome.scorer : -1);
  const won = $derived(winner(game) >= 0);
</script>

{#if scorer >= 0}<Confetti />{/if}

<header class="banner" style:--c={scorer >= 0 ? playerColor(scorer) : 'var(--text-dim)'}>
  {#if outcome.kind === 'point'}
    <span class="big pop-in">🎉 {game.players[scorer].name} <b>+{outcome.points}</b></span>
  {:else}
    <span class="big">🤷 Nobody got it</span>
  {/if}
</header>

<div class="body">
  <section class="answer pop-in" aria-label="The song">
    <div class="fit"><FitText text={game.song?.title ?? ''} max={84} min={24} /></div>
    <p class="artist">{game.song?.artist}</p>
  </section>

  <div class="acts">
    <Button size="lg" onclick={onnext}>{won ? '🏆 See who won' : 'Scores →'}</Button>
    <Button variant="ghost" size="sm" onclick={onundo}>{scorer >= 0 ? 'Wrong name? Undo' : 'Undo, back to the song'}</Button>
  </div>
</div>

<style>
  .banner { order: 0; text-align: center; padding: var(--s-2) 0; min-height: 56px; display: grid; place-items: center; }
  .big { display: inline-block; font-family: var(--font-display); font-weight: 800; font-size: 1.9rem; color: var(--c); line-height: 1.1; }
  .big b { color: var(--c-gold); }
  .body { order: 2; display: flex; flex-direction: column; gap: var(--s-3); padding-bottom: calc(var(--safe-bottom) + var(--s-3)); }
  .answer {
    display: flex; flex-direction: column; align-items: center; gap: var(--s-1);
    padding: var(--s-3) var(--s-4) var(--s-4); border-radius: var(--r-lg);
    background: radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, var(--c-gold) 22%, transparent), transparent 70%), var(--bg-raised);
    border: 2px solid color-mix(in srgb, var(--c-gold) 60%, transparent);
  }
  .fit { width: 100%; height: 120px; color: var(--c-gold); }
  .artist { font-family: var(--font-display); font-weight: 700; font-size: 1.4rem; color: var(--text); text-align: center; }
  .acts { display: flex; flex-direction: column; align-items: center; gap: var(--s-1); }
</style>
