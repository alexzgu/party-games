<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import FitText from '../../components/FitText.svelte';
  import Scoreboard from './Scoreboard.svelte';
  import Confetti from './Confetti.svelte';
  import { playerColor } from './ui';
  import { winner, type GameState } from './logic';

  // Shown to the whole room: the answer, who scored, and the scores so far.
  let { game, onnext, onundo, onleave }: { game: GameState; onnext: () => void; onundo: () => void; onleave: () => void } = $props();

  const outcome = $derived(game.outcome!);
  const scorer = $derived(outcome.kind === 'point' ? outcome.scorer : -1);
  const won = $derived(winner(game) >= 0);
  const nextReader = $derived((game.reader + 1) % game.players.length);
</script>

{#if scorer >= 0}<Confetti />{/if}

<Screen title={gameName('gibberish')} onback={onleave} backLabel="Back to setup" split>
  <div class="split-main">
    <div class="banner {outcome.kind}" style:--c={scorer >= 0 ? playerColor(scorer) : 'var(--text-dim)'}>
      {#if scorer >= 0}
        <span class="big pop-in">🎉 {game.players[scorer].name} got it!</span>
      {:else if outcome.kind === 'timeout'}
        <span class="big">⏰ Time's up</span>
      {:else}
        <span class="big">🤷 Nobody got it</span>
      {/if}
    </div>

    <section class="answer pop-in" aria-label="The answer">
      <p class="phrase">“{game.card?.phrase}” was</p>
      <div class="fit"><FitText text={game.card?.answer ?? ''} max={88} min={24} /></div>
    </section>
  </div>

  <div class="split-side"><Scoreboard {game} flash={scorer} nextReader={won ? -1 : nextReader} /></div>

  {#snippet actions()}
    <Button size="lg" onclick={onnext}>
      {#if won}🏆 See who won{:else}Next: {game.players[nextReader].name} reads →{/if}
    </Button>
    <Button variant="ghost" size="sm" onclick={onundo} tip={scorer >= 0 ? 'Takes the point back and returns to the card' : 'Returns to the card so someone can still score'}>
      {scorer >= 0 ? 'Wrong name? Undo' : 'Undo, back to the card'}
    </Button>
  {/snippet}
</Screen>

<style>
  .banner { text-align: center; padding-top: var(--s-2); }
  .big { display: inline-block; font-family: var(--font-display); font-weight: 800; font-size: 1.9rem; color: var(--c); line-height: 1.1; }
  .answer {
    display: flex; flex-direction: column; align-items: center; gap: var(--s-1);
    padding: var(--s-4); border-radius: var(--r-lg);
    background: radial-gradient(120% 120% at 50% 0%, color-mix(in srgb, var(--c-gold) 22%, transparent), transparent 70%), var(--bg-raised);
    border: 2px solid color-mix(in srgb, var(--c-gold) 60%, transparent);
  }
  .phrase { color: var(--text-dim); font-weight: 600; text-align: center; }
  .fit { width: 100%; height: 150px; color: var(--c-gold); }
  /* A phone on its side (Screen's split): the scores on the left, the answer and the buttons on
     the right; the answer takes the height the buttons leave. */
  @media (orientation: landscape) and (max-height: 500px) {
    .banner { padding-top: 0; }
    .big { font-size: 1.5rem; }
    .answer { flex: 1 1 auto; min-height: 0; padding: var(--s-3); }
    .fit { flex: 1; height: auto; min-height: 56px; }
  }
</style>
