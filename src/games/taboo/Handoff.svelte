<script lang="ts">
  // Pass-the-phone screen: lit by the team's colour from its own side, scores on top, the team's
  // name large, and who does what. The start button ignores taps for a moment (Button's guard),
  // so a double tap on the previous screen cannot start the clock.
  import Button from '../../components/Button.svelte';
  import Scoreboard from './Scoreboard.svelte';
  import GameMenu from './GameMenu.svelte';
  import Rules from './Rules.svelte';
  import { teamColor } from './look';
  import { other, roundNo, scoresBefore, type Game } from './state';

  let { game, outOfCards = false, onstart, onreuse, onhome, onend }: {
    game: Game;
    /** Start found every card of the chosen packs played already. */
    outOfCards?: boolean;
    onstart: () => void;
    /** Deals the played cards again and starts the clock. */
    onreuse: () => void;
    onhome: () => void;
    onend: () => void;
  } = $props();

  const team = $derived(game.active);
  const rival = $derived(other(team));
  const round = $derived(roundNo(game) + (game.turns.length % 2 === 0 ? 1 : 0));
  const of = $derived(game.mode === 'rounds' ? ` of ${game.rounds}` : '');
  const rules = $derived(`Got it +1 · Buzz −1 · Skip ${game.skipCost ? '−1' : 'free'}`);
  let menu = $state<false | 'menu' | 'end'>(false);
</script>

<div class="handoff fade-in t{team}" style:--team={teamColor(team)} style:--rival={teamColor(rival)} style:--accent={teamColor(team)}>
  <header>
    <div class="grow"><Scoreboard {game} scores={scoresBefore(game)} active={team} /></div>
    <Rules />
    <button class="menu" onclick={() => (menu = 'menu')} aria-label="Game menu" aria-expanded={!!menu} data-tip="Pause or end the game">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="5" cy="12" r="2.2" fill="currentColor"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><circle cx="19" cy="12" r="2.2" fill="currentColor"/></svg>
    </button>
  </header>
  <div class="content">
    <div class="top">
      <p class="kicker">Round {round}{of} · your turn</p>
      <h1 class="pop-in">{game.names[team]}</h1>
      <p class="versus">vs <b>{game.names[rival]}</b></p>
    </div>
    <ol class="steps">
      <li class="pop-in" style:animation-delay="120ms">
        <span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><rect x="6" y="2.5" width="12" height="19" rx="2.6" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M10.5 18.5h3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></span>
        <span>Pick a describer. Hand them the phone.</span>
      </li>
      <li class="pop-in rival" style:animation-delay="210ms">
        <span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg></span>
        <span>Someone from <b>{game.names[rival]}</b> sits next to them and hits Buzz on a banned word.</span>
      </li>
      <li class="pop-in" style:animation-delay="300ms">
        <span class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 9v4l2.5 2M9.5 2.5h5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></span>
        <span>{game.seconds} seconds. {rules}.</span>
      </li>
    </ol>
  </div>
  <div class="go">
    {#if outOfCards}
      <p class="err" role="alert">Every card in the chosen packs has been played this game.</p>
      <Button size="lg" onclick={onreuse} tip="Deals the played cards again and starts the clock">Replay cards</Button>
      <Button variant="secondary" onclick={() => (menu = 'end')} tip="Ends this game for good, after asking">End game</Button>
    {:else}
      <Button size="lg" onclick={onstart}>Start clock</Button>
    {/if}
  </div>
</div>

{#if menu}<GameMenu {game} ending={menu === 'end'} onclose={() => (menu = false)} {onhome} {onend} />{/if}

<style>
  .handoff {
    --x: 15%;
    position: relative; isolation: isolate;
    min-height: 100dvh; max-width: 640px; margin: 0 auto;
    display: flex; flex-direction: column; gap: var(--s-5);
    padding: calc(var(--safe-top) + var(--s-3)) calc(var(--safe-right) + var(--s-4)) calc(var(--safe-bottom) + var(--s-4)) calc(var(--safe-left) + var(--s-4));
  }
  .handoff.t1 { --x: 85%; }
  .handoff::before {
    content: ''; position: fixed; inset: 0; z-index: -1; pointer-events: none;
    background:
      radial-gradient(90% 55% at var(--x) 8%, color-mix(in srgb, var(--team) 34%, transparent), transparent 72%),
      radial-gradient(70% 35% at calc(100% - var(--x)) 105%, color-mix(in srgb, var(--rival) 12%, transparent), transparent 70%),
      var(--bg);
  }
  header { display: flex; align-items: center; gap: var(--s-2); }
  /* The scoreboard takes the room the menu leaves, and no more: long team names shorten inside it. */
  .grow { flex: 1; min-width: 0; }
  .menu {
    flex: none; width: 48px; height: 48px; border-radius: var(--r-pill); border: 0;
    background: var(--surface); color: var(--text-dim); display: grid; place-items: center;
  }
  .content { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: var(--s-6); }
  .top { display: flex; flex-direction: column; gap: var(--s-2); }
  .kicker { font-size: 0.85rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-dim); }
  h1 {
    font-size: clamp(2.8rem, 14vw, 4.4rem); line-height: 0.95; color: var(--team); overflow-wrap: anywhere;
    text-shadow: 0 0 36px color-mix(in srgb, var(--team) calc(55% * var(--glow)), transparent);
  }
  .versus { font-size: 1.15rem; color: var(--text-dim); font-weight: 600; }
  .versus b, .rival b { color: var(--rival); }
  .steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  .steps li {
    display: flex; align-items: center; gap: var(--s-3);
    padding: var(--s-3) var(--s-4); border-radius: var(--r-md);
    background: color-mix(in srgb, var(--surface) 80%, transparent);
    border: 1.5px solid var(--line);
    font-size: 1.08rem; font-weight: 700; line-height: 1.25; color: var(--text);
  }
  .icon {
    flex: none; width: 42px; height: 42px; display: grid; place-items: center; border-radius: 50%;
    color: var(--team); background: color-mix(in srgb, var(--team) 16%, transparent);
  }
  .rival .icon { color: var(--rival); background: color-mix(in srgb, var(--rival) 16%, transparent); }
  .go { display: flex; flex-direction: column; gap: var(--s-2); }
  .err { color: var(--bad-ink); font-weight: 700; text-align: center; }
  /* A phone on its side (as Spectrum's hand-off): the team on the left, the steps and the button
     on the right. */
  @media (orientation: landscape) and (max-height: 500px) {
    .handoff {
      height: 100dvh; max-width: 960px; display: grid; gap: var(--s-2) var(--s-5);
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr) auto;
      padding-bottom: calc(var(--safe-bottom) + var(--s-2));
    }
    header { grid-column: 1 / -1; }
    .content { display: contents; }
    .top { grid-column: 1; grid-row: 2 / 4; align-self: center; }
    .steps { grid-column: 2; grid-row: 2; align-self: center; max-height: 100%; overflow-y: auto; }
    .steps li { padding: var(--s-2) var(--s-3); font-size: 1rem; }
    .icon { width: 36px; height: 36px; }
    .go { grid-column: 2; grid-row: 3; }
    h1 { font-size: clamp(2.4rem, 7vw, 3.6rem); }
  }
</style>
