<script lang="ts">
  // Pass-the-phone screen: dark, lit by the team's colour from its own side, with the
  // face-off score on top and the team's name large. The button ignores taps for a moment
  // (Button's guard) so a double tap on the previous screen cannot skip past it.
  import Button from '../../components/Button.svelte';
  import Scoreboard from './Scoreboard.svelte';
  import { teamColor } from './look';
  import { other, scoresBefore, type Game, type TeamIndex } from './state';

  let {
    game,
    team,
    kicker,
    steps,
    button,
    onready,
    onclose,
  }: {
    game: Game;
    team: TeamIndex;
    kicker: string;
    steps: { icon: 'phone' | 'eye' | 'hide'; text: string }[];
    button: string;
    onready: () => void;
    onclose?: () => void;
  } = $props();

  const rival = $derived(other(team));
</script>

<div class="handoff fade-in t{team}" style:--team={teamColor(team)} style:--rival={teamColor(rival)} style:--accent={teamColor(team)}>
  <header>
    <div class="grow"><Scoreboard teams={game.teams} scores={scoresBefore(game)} goal={game.goal} active={team} /></div>
    {#if onclose}
      <button class="menu" onclick={onclose} aria-label="Pause and go home (the game is saved)">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>
      </button>
    {/if}
  </header>
  <div class="content">
    <div class="top">
      <p class="kicker">{kicker}</p>
      <h1 class="pop-in">{game.teams[team].name}</h1>
      <p class="versus">vs <b>{game.teams[rival].name}</b></p>
    </div>
    <ol class="steps">
      {#each steps as s, i (i)}
        <li class="pop-in" style:animation-delay="{120 + i * 90}ms">
          <span class="icon" aria-hidden="true">
            {#if s.icon === 'phone'}
              <svg viewBox="0 0 24 24" width="26" height="26"><rect x="6" y="2.5" width="12" height="19" rx="2.6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M10.5 18.5h3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
            {:else if s.icon === 'eye'}
              <svg viewBox="0 0 24 24" width="26" height="26"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>
            {:else}
              <svg viewBox="0 0 24 24" width="26" height="26"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M4 4l16 16" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>
            {/if}
          </span>
          <span>{s.text}</span>
        </li>
      {/each}
    </ol>
  </div>
  <div class="go">
    <Button size="lg" onclick={onready}>{button}</Button>
  </div>
</div>

<style>
  .handoff {
    --x: 15%;
    position: relative; isolation: isolate;
    min-height: 100dvh; max-width: 640px; margin: 0 auto;
    display: flex; flex-direction: column; gap: var(--s-5);
    padding: calc(var(--safe-top) + var(--s-3)) calc(var(--safe-right) + var(--s-4)) calc(var(--safe-bottom) + var(--s-4)) calc(var(--safe-left) + var(--s-4));
  }
  .handoff.t1 { --x: 85%; }
  /* The team's light comes from its own side of the scoreboard; the rival's is a faint glow opposite. */
  .handoff::before {
    content: ''; position: fixed; inset: 0; z-index: -1; pointer-events: none;
    background:
      radial-gradient(90% 55% at var(--x) 8%, color-mix(in srgb, var(--team) 34%, transparent), transparent 72%),
      radial-gradient(70% 35% at calc(100% - var(--x)) 105%, color-mix(in srgb, var(--rival) 12%, transparent), transparent 70%),
      var(--bg);
  }
  header { display: flex; align-items: center; gap: var(--s-2); }
  .menu {
    flex: none; width: 48px; height: 48px; border-radius: var(--r-pill); border: 0;
    background: var(--surface); color: var(--text-dim); display: grid; place-items: center;
  }
  .content { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: var(--s-6); }
  .top { display: flex; flex-direction: column; gap: var(--s-2); }
  .kicker {
    font-size: 0.85rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-dim);
  }
  h1 {
    font-size: clamp(2.8rem, 14vw, 4.4rem); line-height: 0.95; color: var(--team); overflow-wrap: anywhere;
    text-shadow: 0 0 36px color-mix(in srgb, var(--team) calc(55% * var(--glow)), transparent);
  }
  .versus { font-size: 1.15rem; color: var(--text-dim); font-weight: 600; }
  .versus b { color: var(--rival); }
  .steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  .steps li {
    display: flex; align-items: center; gap: var(--s-3);
    padding: var(--s-3) var(--s-4); border-radius: var(--r-md);
    background: color-mix(in srgb, var(--surface) 80%, transparent);
    border: 1.5px solid var(--line);
    font-size: 1.12rem; font-weight: 700; line-height: 1.25; color: var(--text);
  }
  .icon {
    flex: none; width: 42px; height: 42px; display: grid; place-items: center; border-radius: 50%;
    color: var(--team); background: color-mix(in srgb, var(--team) 16%, transparent);
  }
</style>
