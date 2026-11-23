<script lang="ts">
  // The team sets the needle. The target is not in the page at all here, only the cover.
  import Frame from './Frame.svelte';
  import Dial from './Dial.svelte';
  import ScaleCard from './ScaleCard.svelte';
  import Button from '../../components/Button.svelte';
  import type { Game, Round } from './state';
  import { teamColor } from './look';

  let {
    game,
    round,
    onguess,
    onlock,
    onhome,
    onend,
  }: {
    game: Game;
    round: Round;
    onguess: (v: number) => void;
    onlock: (v: number) => void;
    onhome: () => void;
    onend: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let value = $state(round.guess);
  const team = $derived(game.teams[game.active]);
  const lean = $derived(
    Math.abs(value - 50) < 3 ? 'Dead centre' : `${Math.round(Math.abs(value - 50) * 2)}% toward ${value < 50 ? round.card.left : round.card.right}`,
  );
</script>

<Frame {game} active={game.active} {onhome} {onend}>
  <p class="who" style:--team={teamColor(game.active)}><b>{team.name}</b>, where is it?</p>
  <div class="clue" aria-live="polite">
    {#if round.clue}
      <span class="label faint">The clue</span>
      <q>{round.clue}</q>
    {:else}
      <span class="spoken">Listen to your reader's clue</span>
    {/if}
  </div>
  <div class="tuner">
    <Dial bind:value interactive label="Your guess" valuetext={lean} onrelease={onguess} />
    <ScaleCard card={round.card} />
  </div>
  {#snippet info()}
    <p>Listen to your reader's clue.</p>
    <p>Drag the needle anywhere on the dial. Reader, no more hints!</p>
    <p>When your team agrees, tap <b>Lock it in</b>. The closer to the hidden target, the more points.</p>
  {/snippet}
  {#snippet actions()}
    <Button size="lg" onclick={() => onlock(value)} tip="Makes this your team's final guess">Lock it in</Button>
  {/snippet}
</Frame>

<style>
  .who { font-size: 1.15rem; }
  .who b { color: var(--team); }
  .clue {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--s-1);
    min-height: 88px; padding: var(--s-3) var(--s-4); border-radius: var(--r-lg);
    background: var(--bg-raised); border: 1.5px solid var(--line); text-align: center;
  }
  .label { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; }
  q { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.6rem, 8vw, 2.4rem); line-height: 1.05; overflow-wrap: anywhere; }
  .spoken { font-family: var(--font-display); font-weight: 700; font-size: 1.35rem; color: var(--text-dim); }
  .tuner { display: flex; flex-direction: column; gap: var(--s-3); }
</style>
