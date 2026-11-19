<script lang="ts">
  // The winner's colour floods in, scores stack up, confetti falls. A tap during the entrance
  // shows everything at once; any tap clears the confetti.
  import { onMount } from 'svelte';
  import Button from '../../components/Button.svelte';
  import Confetti from './Confetti.svelte';
  import { other, type Game, type TeamIndex } from './state';
  import { teamColor } from './look';
  import { tapToSkip } from './skip';
  import { sfx } from '../../lib/sound';
  import { haptic } from '../../lib/haptics';

  let { game, onrematch, onsetup, onhome }:
    { game: Game; onrematch: () => void; onsetup: () => void; onhome: () => void } = $props();

  const ENTRANCE_MS = 900;
  const w = $derived((game.winner ?? 0) as TeamIndex);
  const l = $derived(other(w));
  let entering = $state(true);
  let confetti = $state(true);

  onMount(() => {
    sfx.win();
    haptic.end();
    const t = setTimeout(() => (entering = false), ENTRANCE_MS);
    const stop = tapToSkip(() => entering, () => (entering = false));
    const clear = () => (confetti = false);
    addEventListener('pointerdown', clear);
    return () => { clearTimeout(t); stop(); removeEventListener('pointerdown', clear); };
  });
</script>

{#if confetti}<Confetti colors={[teamColor(w), teamColor(w), teamColor(l), 'var(--c-gold)']} />{/if}
<div class="win fade-in t{w}" class:done={!entering} style:--team={teamColor(w)} style:--accent={teamColor(w)}>
  <div class="trophy pop-in" aria-hidden="true">🏆</div>
  <h1 class="pop-in" style:animation-delay="120ms"><span>{game.teams[w].name}</span> win!</h1>
  <div class="final" aria-label="Final score">
    <div class="row pop-in" style:animation-delay="320ms" style:--team={teamColor(w)}><span>{game.teams[w].name}</span><b>{game.teams[w].score}</b></div>
    <div class="row lose pop-in" style:animation-delay="440ms" style:--team={teamColor(l)}><span>{game.teams[l].name}</span><b>{game.teams[l].score}</b></div>
  </div>
  <p class="faint pop-in" style:animation-delay="560ms">{game.roundNo} rounds · first to {game.goal}</p>
  <div class="actions pop-in" style:animation-delay="680ms">
    <Button size="lg" onclick={onrematch}>Rematch</Button>
    <Button variant="secondary" onclick={onsetup}>Change teams or packs</Button>
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
  .done :global(.pop-in), .done.pop-in, .done.fade-in { animation: none; }
  .trophy { font-size: 5rem; line-height: 1; filter: drop-shadow(0 10px 24px rgb(0 0 0 / 0.5)); }
  h1 { font-size: clamp(2.6rem, 12vw, 4rem); line-height: 1; }
  h1 span { color: var(--team); display: block; text-shadow: 0 0 36px color-mix(in srgb, var(--team) 55%, transparent); overflow-wrap: anywhere; }
  .final { width: 100%; display: flex; flex-direction: column; gap: var(--s-2); margin-top: var(--s-3); }
  .row {
    display: flex; justify-content: space-between; align-items: center;
    padding: var(--s-3) var(--s-4); border-radius: var(--r-md);
    background: color-mix(in srgb, var(--team) 18%, var(--surface)); border: 2px solid var(--team);
    box-shadow: 0 0 24px color-mix(in srgb, var(--team) 35%, transparent);
    font-weight: 800; font-size: 1.15rem; color: var(--team);
  }
  .row b { font-family: var(--font-display); font-size: 2rem; line-height: 1; color: var(--text); }
  .row.lose { background: color-mix(in srgb, var(--team) 8%, var(--surface)); border-color: color-mix(in srgb, var(--team) 35%, transparent); box-shadow: none; }
  .row.lose b { color: var(--text-dim); }
  .actions { width: 100%; margin-top: auto; display: flex; flex-direction: column; gap: var(--s-2); }
</style>
