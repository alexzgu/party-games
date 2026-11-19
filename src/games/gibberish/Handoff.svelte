<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import { playerColor } from './ui';
  import type { GameState } from './logic';

  // Between cards: make it unmistakable who takes the phone and that nobody else looks.
  let { game, onbegin, onleave, error = '' }: { game: GameState; onbegin: () => void; onleave: () => void; error?: string } = $props();
  const reader = $derived(game.players[game.reader]);
  const first = $derived(game.cardsPlayed === 0 && game.players.every((p) => p.score === 0));
</script>

<Screen title={gameName('gibberish')} onback={onleave} backLabel="Back to setup">
<div class="center">
  <div class="hand" style:--c={playerColor(game.reader)}>
    <p class="kicker">Pass the phone to</p>
    <div class="who pop-in">
      <span class="glow" aria-hidden="true"></span>
      <span class="name">{reader.name}</span>
    </div>
    <p class="role">📣 {reader.name} reads this card</p>
  </div>

  <div class="look-away">
    <span class="eyes" aria-hidden="true">🙈</span>
    <p><b>Everyone else: eyes off the phone.</b> Just listen.</p>
  </div>

  {#if first}
    <ol class="how" aria-label="How to play">
      <li><b>{reader.name}</b> reads a nonsense phrase out loud. Again and again, faster each time.</li>
      <li>Everyone shouts what it really sounds like.</li>
      <li>First to say it scores. First to {game.target} points wins.</li>
    </ol>
  {:else}
    <p class="meta">Card {game.cardsPlayed + 1} · first to {game.target} wins</p>
  {/if}

  {#if error}<p class="error" role="alert">{error}</p>{/if}
</div>

  {#snippet actions()}
    <Button size="lg" onclick={onbegin}>I'm {reader.name}, show me</Button>
  {/snippet}
</Screen>

<style>
  .center { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: var(--s-4); }
  .hand { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--s-3); }
  .kicker { color: var(--text-dim); font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.85rem; }
  .who { position: relative; display: grid; place-items: center; min-height: 150px; width: 100%; }
  .glow {
    position: absolute; width: 190px; height: 190px; border-radius: 50%;
    background: radial-gradient(circle, color-mix(in srgb, var(--c) 45%, transparent), transparent 68%);
    animation: breathe 2.4s ease-in-out infinite;
  }
  .name {
    position: relative; font-family: var(--font-display); font-weight: 800; color: var(--c);
    font-size: clamp(2.6rem, 17vw, 5rem); line-height: 1; letter-spacing: -0.03em; overflow-wrap: anywhere;
  }
  .role { font-size: 1.15rem; font-weight: 600; }
  .look-away {
    display: flex; align-items: center; gap: var(--s-3); padding: var(--s-4);
    border-radius: var(--r-lg); background: var(--bg-raised); border: 1.5px solid var(--line-strong); font-size: 1.05rem;
  }
  .eyes { font-size: 2.4rem; flex: none; }
  .how { margin: 0; padding: var(--s-4) var(--s-4) var(--s-4) calc(var(--s-4) + 1.2em); border-radius: var(--r-md); background: var(--surface); color: var(--text-dim); display: flex; flex-direction: column; gap: var(--s-2); }
  .how b { color: var(--text); }
  .meta { text-align: center; color: var(--text-faint); }
  .error { color: var(--bad-ink); text-align: center; }
  @keyframes breathe { 50% { transform: scale(1.12); opacity: 0.7; } }
  @media (prefers-reduced-motion: reduce) { .glow { animation: none; } }
</style>
