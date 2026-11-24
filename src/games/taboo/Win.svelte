<script lang="ts">
  // The winner's colour floods in, scores stack up, confetti falls. A tap during the entrance
  // shows everything at once (TapToFinish around it); any tap clears the confetti.
  import { onMount } from 'svelte';
  import Button from '../../components/Button.svelte';
  import Confetti from './Confetti.svelte';
  import { other, scores, type Game, type TeamIndex } from './state';
  import { winLine } from './summary';
  import { teamColor } from './look';
  import { sfx } from '../../lib/sound';
  import { haptic } from '../../lib/haptics';

  let { game, onrematch, onsetup, onhome }:
    { game: Game; onrematch: () => void; onsetup: () => void; onhome: () => void } = $props();

  const w = $derived((game.winner ?? 0) as TeamIndex);
  const l = $derived(other(w));
  const s = $derived(scores(game));
  let confetti = $state(true);

  onMount(() => {
    sfx.win();
    haptic.end();
    const clear = () => (confetti = false);
    addEventListener('pointerdown', clear);
    return () => removeEventListener('pointerdown', clear);
  });
</script>

{#if confetti}<Confetti colors={[teamColor(w), teamColor(w), teamColor(l), 'var(--c-gold)']} />{/if}
<div class="win fade-in t{w}" style:--team={teamColor(w)} style:--accent={teamColor(w)}>
  <div class="trophy pop-in" aria-hidden="true">🏆</div>
  <h1 class="pop-in" style:animation-delay="120ms"><span>{game.names[w]}</span> win!</h1>
  <div class="final" aria-label="Final score">
    <div class="row pop-in" style:animation-delay="320ms" style:--team={teamColor(w)}><span>{game.names[w]}</span><b>{s[w]}</b></div>
    <div class="row lose pop-in" style:animation-delay="440ms" style:--team={teamColor(l)}><span>{game.names[l]}</span><b>{s[l]}</b></div>
  </div>
  <p class="faint pop-in" style:animation-delay="560ms">
    {winLine(game)}
  </p>
  <div class="actions pop-in" style:animation-delay="680ms">
    <Button size="lg" onclick={onrematch} tip="Same teams and packs, scores back to zero">Rematch</Button>
    <Button variant="secondary" onclick={onsetup}>Setup</Button>
    <Button variant="ghost" onclick={onhome}>Home</Button>
  </div>
</div>

<style>
  .win {
    --x: 25%;
    position: relative; isolation: isolate;
    min-height: 100dvh; max-width: 640px; margin: 0 auto;
    display: flex; flex-direction: column; align-items: center; gap: var(--s-4); text-align: center;
    padding: calc(var(--safe-top) + var(--s-7)) calc(var(--safe-right) + var(--s-4)) calc(var(--safe-bottom) + var(--s-4)) calc(var(--safe-left) + var(--s-4));
  }
  .win.t1 { --x: 75%; }
  .win::before {
    content: ''; position: fixed; inset: 0; z-index: -1; pointer-events: none;
    background: radial-gradient(110% 55% at var(--x) 0%, color-mix(in srgb, var(--team) 38%, transparent), transparent 75%), var(--bg);
  }
  .trophy { font-size: 5rem; line-height: 1; filter: drop-shadow(0 10px 24px color-mix(in srgb, var(--shade) 50%, transparent)); }
  h1 { font-size: clamp(2.6rem, 12vw, 4rem); line-height: 1; }
  h1 span { color: var(--team); display: block; text-shadow: 0 0 36px color-mix(in srgb, var(--team) calc(55% * var(--glow)), transparent); overflow-wrap: anywhere; }
  .final { width: 100%; display: flex; flex-direction: column; gap: var(--s-2); margin-top: var(--s-3); }
  .row {
    display: flex; justify-content: space-between; align-items: center;
    padding: var(--s-3) var(--s-4); border-radius: var(--r-md);
    background: color-mix(in srgb, var(--team) 18%, var(--surface)); border: 2px solid var(--team);
    box-shadow: 0 0 24px color-mix(in srgb, var(--team) calc(35% * var(--glow)), transparent);
    font-weight: 800; font-size: 1.15rem; color: var(--team);
  }
  .row b { font-family: var(--font-display); font-size: 2rem; line-height: 1; color: var(--text); }
  .row.lose { background: color-mix(in srgb, var(--team) 8%, var(--surface)); border-color: color-mix(in srgb, var(--team) 35%, transparent); box-shadow: none; }
  .row.lose b { color: var(--text-dim); }
  .actions { width: 100%; margin-top: auto; display: flex; flex-direction: column; gap: var(--s-2); }
  /* A phone on its side (as Spectrum's win): the winner and how the game went on the left, the
     scores and buttons on the right. */
  @media (orientation: landscape) and (max-height: 500px) {
    .win {
      max-width: 960px; display: grid; align-items: center; column-gap: var(--s-5); row-gap: var(--s-2);
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      padding-top: calc(var(--safe-top) + var(--s-3)); padding-bottom: calc(var(--safe-bottom) + var(--s-2));
    }
    .trophy { grid-column: 1; grid-row: 1; align-self: end; font-size: 3rem; }
    h1 { grid-column: 1; grid-row: 2; font-size: clamp(2rem, 6vw, 3.2rem); }
    .faint { grid-column: 1; grid-row: 3; align-self: start; }
    .final, .actions { grid-column: 2; margin: 0; }
    .final { grid-row: 1 / 3; }
    .actions { grid-row: 3; }
    .row { padding: var(--s-2) var(--s-4); }
    .row b { font-size: 1.6rem; }
  }
</style>
