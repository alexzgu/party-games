<script lang="ts">
  // In-game page: scoreboard on top, content, primary action pinned above the home bar,
  // an "i" that opens the screen's how-to text (`info`), and a small menu to pause or end the game.
  import type { Snippet } from 'svelte';
  import Scoreboard from './Scoreboard.svelte';
  import Button from '../../components/Button.svelte';
  import Popup from '../../components/Popup.svelte';
  import type { Game, TeamIndex } from './state';
  import { scoresBefore } from './state';
  import { teamColor } from './look';
  import { revealedLog } from './summary';

  let {
    game,
    active = null,
    onhome,
    onend,
    actions,
    info,
    children,
  }: {
    game: Game;
    active?: TeamIndex | null;
    onhome: () => void;
    onend: () => void;
    actions?: Snippet;
    /** How-to text for this screen, shown in a popup behind the "i" button. */
    info?: Snippet;
    children: Snippet;
  } = $props();

  let menu = $state(false);
  let confirmEnd = $state(false);
  let help = $state(false);
  const close = () => { menu = false; confirmEnd = false; };
</script>

<div class="frame fade-in" class:t1={active === 1} class:lit={active !== null} style:--team={active !== null ? teamColor(active) : undefined}
  style:--accent={active !== null ? teamColor(active) : undefined}>
  <header>
    <div class="grow"><Scoreboard teams={game.teams} scores={scoresBefore(game)} goal={game.goal} {active} /></div>
    {#if info}
      <button class="menu info" aria-label="How this works" onclick={() => (help = true)}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="7.6" r="1.5" fill="currentColor"/><path d="M12 11v6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
      </button>
    {/if}
    <button class="menu" aria-label="Game menu" aria-expanded={menu} onclick={() => (menu = true)}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="5" cy="12" r="2.2" fill="currentColor"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><circle cx="19" cy="12" r="2.2" fill="currentColor"/></svg>
    </button>
  </header>
  <main>{@render children()}</main>
  {#if actions}<footer>{@render actions()}</footer>{/if}
</div>

{#if help && info}
  <Popup title="How this works" onclose={() => (help = false)}><div class="how">{@render info()}</div></Popup>
{/if}
{#if menu}
  <div class="scrim fade-in" role="presentation" onclick={close}></div>
  <div class="sheet pop-in" role="dialog" aria-modal="true" aria-label="Game menu">
    {#if confirmEnd}
      <h3>End game?</h3>
      <p class="muted">{revealedLog(game).length ? 'The scores so far go in History, marked as ended early.' : 'No round has been scored yet, so nothing goes in History.'}</p>
      <Button size="lg" variant="danger" onclick={onend}>Yes, end the game</Button>
      <Button variant="secondary" onclick={close}>No, keep playing</Button>
    {:else}
      <h3>Game paused</h3>
      <p class="muted">Round {game.roundNo || 1} · first to {game.goal}. The game is saved, so you can come back to it.</p>
      <Button size="lg" onclick={close}>Keep playing</Button>
      <Button variant="secondary" onclick={onhome}>Pause and go home</Button>
      <Button variant="danger" onclick={() => (confirmEnd = true)}>End game</Button>
    {/if}
  </div>
{/if}

<style>
  .frame {
    height: 100dvh; max-width: 640px; margin: 0 auto;
    display: flex; flex-direction: column;
    padding: calc(var(--safe-top) + var(--s-3)) calc(var(--safe-right) + var(--s-4)) 0 calc(var(--safe-left) + var(--s-4));
    position: relative; isolation: isolate;
  }
  /* A soft glow in the playing team's colour, from its side of the scoreboard. */
  .lit::before {
    content: ''; position: fixed; inset: 0; z-index: -1; pointer-events: none;
    background: radial-gradient(80% 40% at 15% -5%, color-mix(in srgb, var(--team) 20%, transparent), transparent 70%), var(--bg);
  }
  .lit.t1::before { background: radial-gradient(80% 40% at 85% -5%, color-mix(in srgb, var(--team) 20%, transparent), transparent 70%), var(--bg); }
  header { display: flex; align-items: center; gap: var(--s-1); }
  .grow { min-width: 0; }
  .menu {
    flex: none; width: 44px; height: 44px; border-radius: var(--r-pill); border: 0;
    background: var(--surface); color: var(--text-dim); display: grid; place-items: center;
  }
  .info { color: var(--accent); }
  main { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: var(--s-3); padding: var(--s-3) 0; }
  /* The dial is the one part that gives up height when a screen is short (see Dial). */
  main > :global(*) { flex-shrink: 0; }
  main > :global(.tuner) { flex: 0 1 auto; min-height: 0; }
  /* Landscape phones are too short for that: the page scrolls instead. */
  @media (max-height: 500px) { .frame { height: auto; min-height: 100dvh; } main { flex: 1 0 auto; } }
  .how :global(p) { margin: 0 0 var(--s-3); }
  .how :global(p:last-child) { margin-bottom: 0; }
  footer {
    position: sticky; bottom: 0; display: flex; flex-direction: column; gap: var(--s-2);
    padding: var(--s-3) 0 calc(var(--safe-bottom) + var(--s-4));
    background: linear-gradient(to top, var(--bg) 70%, transparent);
  }
  .scrim { position: fixed; inset: 0; background: var(--scrim-soft); z-index: 10; }
  .sheet {
    position: fixed; z-index: 11; left: 50%; bottom: 0; width: min(640px, 100%); transform: translateX(-50%);
    display: flex; flex-direction: column; gap: var(--s-3);
    padding: var(--s-5) var(--s-4) calc(var(--safe-bottom) + var(--s-5));
    background: var(--bg-raised); border-radius: var(--r-lg) var(--r-lg) 0 0; box-shadow: var(--shadow);
  }
  .sheet.pop-in { animation-name: sheet-up; }
  @keyframes sheet-up { from { transform: translate(-50%, 40px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
</style>
