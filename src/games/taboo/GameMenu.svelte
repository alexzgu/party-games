<script lang="ts">
  // The in-game menu as a bottom sheet: keep playing, pause and go home (the game stays saved),
  // or end the game (it goes in History as ended early once a card has been marked).
  import Button from '../../components/Button.svelte';
  import type { Game } from './state';

  let {
    game,
    title = 'Game paused',
    note = '',
    resume = 'Keep playing',
    solid = false,
    ending = false,
    onclose,
    onhome,
    onend,
  }: {
    game: Game;
    title?: string;
    /** A line under the title, e.g. who is describing. */
    note?: string;
    resume?: string;
    /** An opaque backdrop, so nothing behind the menu can be read (the card during a turn). */
    solid?: boolean;
    /** Opens straight on "End game?" (from a screen's own End game button). */
    ending?: boolean;
    onclose: () => void;
    onhome: () => void;
    onend: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let confirmEnd = $state(ending);
  const marked = $derived(game.turns.some((t) => t.cards.length > 0));
  let sheet = $state<HTMLElement>();
  $effect(() => sheet?.focus());
</script>

<div class="scrim fade-in" class:solid role="presentation" onclick={onclose}></div>
<div class="sheet pop-in" role="dialog" aria-modal="true" aria-label={title} tabindex="-1" bind:this={sheet}>
  {#if confirmEnd}
    <h3>End game?</h3>
    <p class="muted">{marked ? 'The scores so far go in History, marked as ended early.' : 'Nothing has been scored yet, so nothing goes in History.'}</p>
    <Button size="lg" variant="danger" onclick={onend}>Yes, end the game</Button>
    <Button variant="secondary" onclick={() => (ending ? onclose() : (confirmEnd = false))}>No, keep playing</Button>
  {:else}
    <h3>{title}</h3>
    <p class="muted">{note ? note + ' ' : ''}The game is saved, so you can come back to it.</p>
    <Button size="lg" onclick={onclose}>{resume}</Button>
    <Button variant="secondary" onclick={onhome}>Pause and go home</Button>
    <Button variant="danger" onclick={() => (confirmEnd = true)}>End game</Button>
  {/if}
</div>

<style>
  .scrim { position: fixed; inset: 0; background: var(--scrim-soft); z-index: 30; }
  .scrim.solid { background: color-mix(in srgb, var(--bg) 94%, transparent); }
  .sheet {
    position: fixed; z-index: 31; left: 50%; bottom: 0; width: min(640px, 100%); transform: translateX(-50%);
    display: flex; flex-direction: column; gap: var(--s-3);
    padding: var(--s-5) var(--s-4) calc(var(--safe-bottom) + var(--s-5));
    background: var(--bg-raised); border-radius: var(--r-lg) var(--r-lg) 0 0; box-shadow: var(--shadow);
  }
  .sheet:focus { outline: none; }
  .sheet.pop-in { animation-name: sheet-up; }
  @keyframes sheet-up { from { transform: translate(-50%, 40px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
</style>
