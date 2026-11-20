<script lang="ts">
  // The other team calls which side of the locked needle the target is on.
  import Frame from './Frame.svelte';
  import Dial from './Dial.svelte';
  import ScaleCard from './ScaleCard.svelte';
  import Button from '../../components/Button.svelte';
  import { other, type Game, type Round } from './state';
  import { teamColor } from './look';
  import type { Side } from './scoring';

  let { game, round, oncall, onhome, onend }:
    { game: Game; round: Round; oncall: (s: Side) => void; onhome: () => void; onend: () => void } = $props();

  const thief = $derived(other(game.active));
</script>

<Frame {game} active={thief} {onhome} {onend}>
  <div class="banner pop-in" style:--team={teamColor(thief)}>
    <span class="name">{game.teams[thief].name}</span>
    <span class="ask">Steal a point: is the target <b>left</b> or <b>right</b> of the needle?</span>
  </div>
  {#if round.clue}<p class="clue faint">Clue: <q>{round.clue}</q></p>{/if}
  <div class="tuner">
    <Dial value={round.guess} label="Locked guess" />
    <ScaleCard card={round.card} />
  </div>
  {#snippet info()}
    <p><b>{game.teams[thief].name}</b>: steal a point. Is the target <b>left</b> or <b>right</b> of the needle?</p>
    <p>Call the right side and your team gets 1 point. Then everyone sees where the target was.</p>
  {/snippet}
  {#snippet actions()}
    <div class="pick" style:--accent={teamColor(thief)}>
      <Button size="lg" onclick={() => oncall('left')}>◀ Left</Button>
      <Button size="lg" onclick={() => oncall('right')}>Right ▶</Button>
    </div>
  {/snippet}
</Frame>

<style>
  .banner {
    display: flex; flex-direction: column; gap: var(--s-1);
    padding: var(--s-4); border-radius: var(--r-lg);
    background: color-mix(in srgb, var(--team) 14%, var(--bg-raised));
    border: 2px solid var(--team);
    box-shadow: 0 0 28px color-mix(in srgb, var(--team) calc(30% * var(--glow)), transparent);
  }
  .banner b { color: var(--team); }
  .name { font-family: var(--font-display); font-weight: 800; font-size: 1.6rem; line-height: 1.05; color: var(--team); }
  .ask { font-size: 1.1rem; font-weight: 600; }
  .clue { text-align: center; }
  .tuner { display: flex; flex-direction: column; gap: var(--s-3); }
  .pick { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-2); }
</style>
