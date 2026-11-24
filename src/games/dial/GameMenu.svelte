<script lang="ts">
  // The pause sheet behind every in-game "⋯": keep playing, pause and go home (the game stays
  // saved), or end the game after a confirming second step.
  import Button from '../../components/Button.svelte';
  import type { Game } from './state';
  import { revealedLog } from './summary';

  let { game, onclose, onhome, onend }: { game: Game; onclose: () => void; onhome: () => void; onend: () => void } = $props();
  let confirmEnd = $state(false);
</script>

<div class="scrim fade-in" role="presentation" onclick={onclose}></div>
<div class="sheet pop-in" role="dialog" aria-modal="true" aria-label="Game menu">
  {#if confirmEnd}
    <h3>End game?</h3>
    <p class="muted">{revealedLog(game).length ? 'The scores so far go in History, marked as ended early.' : 'No round has been scored yet, so nothing goes in History.'}</p>
    <Button size="lg" variant="danger" onclick={onend}>End game</Button>
    <Button variant="secondary" onclick={onclose}>Keep playing</Button>
  {:else}
    <h3>Game paused</h3>
    <p class="muted">Round {game.roundNo || 1} · first to {game.goal}. The game is saved, so you can come back to it.</p>
    <Button size="lg" onclick={onclose}>Keep playing</Button>
    <Button variant="secondary" onclick={onhome} tip="The game is saved so you can come back to it">Go home</Button>
    <Button variant="danger" onclick={() => (confirmEnd = true)} tip="Ends this game for good, after asking">End game</Button>
  {/if}
</div>

<style>
  .scrim { position: fixed; inset: 0; background: var(--scrim-soft); z-index: var(--z-overlay); }
  .sheet {
    position: fixed; z-index: calc(var(--z-overlay) + 1); left: 50%; bottom: 0; width: min(640px, 100%); transform: translateX(-50%);
    max-height: 100dvh; overflow-y: auto;
    display: flex; flex-direction: column; gap: var(--s-3);
    padding: var(--s-5) calc(var(--safe-right) + var(--s-4)) calc(var(--safe-bottom) + var(--s-5)) calc(var(--safe-left) + var(--s-4));
    background: var(--bg-raised); border-radius: var(--r-lg) var(--r-lg) 0 0; box-shadow: var(--shadow);
  }
  .sheet.pop-in { animation-name: sheet-up; }
  @keyframes sheet-up { from { transform: translate(-50%, 40px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
</style>
