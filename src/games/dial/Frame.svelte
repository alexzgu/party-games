<script lang="ts">
  // In-game page: scoreboard on top, content, primary action pinned above the home bar,
  // an "i" that opens the screen's how-to text (`info`), and a small menu to pause or end the game.
  import type { Snippet } from 'svelte';
  import Scoreboard from './Scoreboard.svelte';
  import GameMenu from './GameMenu.svelte';
  import Popup from '../../components/Popup.svelte';
  import type { Game, TeamIndex } from './state';
  import { scoresBefore } from './state';
  import { teamColor } from './look';

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
  let help = $state(false);
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
  <GameMenu {game} onclose={() => (menu = false)} {onhome} {onend} />
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
  /* A phone on its side: the dial takes the right half at full height, everything else stacks
     on the left with the main button under it, so nothing scrolls and the dial stays whole.
     Up to four items stack on the left (empty rows only add their gap). */
  @media (orientation: landscape) and (max-height: 500px) {
    .frame {
      display: grid; max-width: 960px; column-gap: var(--s-5); row-gap: var(--s-2);
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
      grid-template-rows: auto repeat(4, auto) minmax(0, 1fr) auto;
      padding-bottom: calc(var(--safe-bottom) + var(--s-2));
    }
    header { grid-column: 1 / -1; }
    main { display: contents; }
    main > :global(*) { grid-column: 1; min-width: 0; }
    main > :global(.tuner) { grid-column: 2; grid-row: 2 / -1; min-height: 0; align-self: stretch; justify-content: center; }
    footer { grid-column: 1; grid-row: -2; position: static; padding: var(--s-2) 0 0; background: none; }
  }
  /* Short and upright (rare): the page scrolls. */
  @media (orientation: portrait) and (max-height: 500px) { .frame { height: auto; min-height: 100dvh; } main { flex: 1 0 auto; } }
  .how :global(p) { margin: 0 0 var(--s-3); }
  .how :global(p:last-child) { margin-bottom: 0; }
  footer {
    position: sticky; bottom: 0; display: flex; flex-direction: column; gap: var(--s-2);
    padding: var(--s-3) 0 calc(var(--safe-bottom) + var(--s-4));
    background: linear-gradient(to top, var(--bg) 70%, transparent);
  }
</style>
