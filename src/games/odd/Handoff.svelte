<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Rules from './Rules.svelte';
  import { playerColor } from './ui';
  import type { GameState } from './logic';
  import { tapGuard } from '../../lib/tapGuard';

  // The phone goes to the next player, who taps Show to see their secret alone. Back goes to
  // the previous player's hand-off (setup from the first), never onto a secret.
  let { game, onshow, onback }: { game: GameState; onshow: () => void; onback: () => void } = $props();
  const name = $derived(game.players[game.seat].name);
  // This screen stays up while Back walks from player to player: a back tap counts only once this
  // player's hand-off has been on screen for the guard time, so a double tap steps back one player.
  let ready = $state(tapGuard());
  $effect.pre(() => { void game.seat; ready = tapGuard(); });
</script>

<Screen title={gameName('odd')} onback={() => ready() && onback()} backLabel={game.seat > 0 ? 'Previous player' : 'Back to setup'}>
  {#snippet trailing()}<Rules hint={game.hint} oddNeverStarts={game.oddNeverStarts} />{/snippet}
  <div class="hand" style:--c={playerColor(game.seat)}>
    <p class="kicker">Round {game.log.length + 1} of {game.rounds} · player {game.seat + 1} of {game.players.length}</p>
    <p class="lead">Pass the phone to</p>
    <div class="who pop-in">
      <span class="glow" aria-hidden="true"></span>
      <span class="name">{name}</span>
    </div>
    <p class="hint">Only {name} looks. Tap Show, read it, then Hide.</p>
  </div>

  {#snippet actions()}
    <Button size="lg" onclick={onshow}>Show</Button>
  {/snippet}
</Screen>

<style>
  .hand { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: var(--s-2); min-height: 50dvh; }
  .kicker { color: var(--text-faint); font-weight: 700; font-size: 0.85rem; font-variant-numeric: tabular-nums; }
  .lead { color: var(--text-dim); font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.9rem; }
  .who { position: relative; display: grid; place-items: center; min-height: 130px; width: 100%; }
  .glow {
    position: absolute; width: 180px; height: 180px; border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--c) calc(45% * var(--glow)), transparent), transparent 68%);
    animation: breathe 2.4s ease-in-out infinite;
  }
  .name {
    position: relative; font-family: var(--font-display); font-weight: 800; color: var(--c);
    font-size: clamp(2.6rem, 16vw, 5rem); line-height: 1; letter-spacing: -0.03em; overflow-wrap: anywhere;
  }
  .hint { font-size: 1.05rem; font-weight: 600; max-width: 22em; color: var(--text-dim); }
  @keyframes breathe { 50% { transform: scale(1.12); opacity: 0.7; } }
  @media (prefers-reduced-motion: reduce) { .glow { animation: none; } }
</style>
