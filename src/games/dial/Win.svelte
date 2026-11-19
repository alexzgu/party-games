<script lang="ts">
  import { onMount } from 'svelte';
  import Button from '../../components/Button.svelte';
  import Confetti from './Confetti.svelte';
  import { other, type Game, type TeamIndex } from './state';
  import { teamColor, TEAM_COLORS } from './look';
  import { sfx } from '../../lib/sound';
  import { haptic } from '../../lib/haptics';

  let { game, onrematch, onsetup, onhome }:
    { game: Game; onrematch: () => void; onsetup: () => void; onhome: () => void } = $props();

  const w = $derived((game.winner ?? 0) as TeamIndex);
  const l = $derived(other(w));

  onMount(() => { sfx.win(); haptic.end(); });
</script>

<Confetti colors={[...TEAM_COLORS, 'var(--c-dial)', 'var(--c-gold)']} />
<div class="win fade-in" style:--team={teamColor(w)}>
  <div class="trophy pop-in" aria-hidden="true">🏆</div>
  <h1 class="pop-in"><span>{game.teams[w].name}</span> win!</h1>
  <div class="final" aria-label="Final score">
    <div class="row" style:--team={teamColor(w)}><span>{game.teams[w].name}</span><b>{game.teams[w].score}</b></div>
    <div class="row lose" style:--team={teamColor(l)}><span>{game.teams[l].name}</span><b>{game.teams[l].score}</b></div>
  </div>
  <p class="faint">{game.roundNo} rounds, first to {game.goal}</p>
  <div class="actions">
    <Button size="lg" onclick={onrematch}>Rematch</Button>
    <Button variant="secondary" onclick={onsetup}>Change teams or packs</Button>
    <Button variant="ghost" onclick={onhome}>Home</Button>
  </div>
</div>

<style>
  .win {
    min-height: 100dvh; max-width: 640px; margin: 0 auto;
    display: flex; flex-direction: column; align-items: center; gap: var(--s-4); text-align: center;
    padding: calc(var(--safe-top) + var(--s-7)) calc(var(--safe-right) + var(--s-4)) calc(var(--safe-bottom) + var(--s-4)) calc(var(--safe-left) + var(--s-4));
    background: radial-gradient(100% 50% at 50% 0%, color-mix(in srgb, var(--team) 30%, transparent), transparent 75%);
  }
  .trophy { font-size: 5rem; line-height: 1; filter: drop-shadow(0 10px 24px rgb(0 0 0 / 0.5)); }
  h1 { font-size: clamp(2.6rem, 12vw, 4rem); line-height: 1; }
  h1 span { color: var(--team); display: block; }
  .final { width: 100%; display: flex; flex-direction: column; gap: var(--s-2); margin-top: var(--s-3); }
  .row {
    display: flex; justify-content: space-between; align-items: center;
    padding: var(--s-3) var(--s-4); border-radius: var(--r-md);
    background: color-mix(in srgb, var(--team) 18%, var(--surface)); border: 2px solid var(--team);
    font-weight: 700; font-size: 1.15rem;
  }
  .row b { font-family: var(--font-display); font-size: 2rem; line-height: 1; }
  .row.lose { border-color: transparent; background: var(--surface); opacity: 0.8; }
  .actions { width: 100%; margin-top: auto; display: flex; flex-direction: column; gap: var(--s-2); }
</style>
