<script lang="ts">
  // The describer's screen: the word huge, its five banned words, the clock, and three buttons.
  // Got it and Skip are the describer's; Buzz is for the rival sitting next to them. Every tap
  // goes straight to the parent, which saves; the clock counts to a fixed end time and is
  // never skippable. Leaving the app pauses it, and a reload resumes paused.
  import { onMount } from 'svelte';
  import FitText from '../../components/FitText.svelte';
  import GameMenu from './GameMenu.svelte';
  import { sfx, unlockAudio } from '../../lib/sound';
  import { haptic } from '../../lib/haptics';
  import { teamColor } from './look';
  import { other, turnScore, type Game, type Mark } from './state';

  let { game, startPaused = false, onmark, ontimeup, ontick, onhome, onend }: {
    game: Game;
    startPaused?: boolean;
    onmark: (m: Exclude<Mark, 'time'>) => void;
    ontimeup: () => void;
    ontick: (msLeft: number) => void;
    onhome: () => void;
    onend: () => void;
  } = $props();

  const team = $derived(game.active);
  const rival = $derived(other(team));
  const turn = $derived(game.turns.at(-1)!);
  const total = $derived(game.seconds * 1000);
  const pts = $derived(turnScore(turn, game.skipCost));

  // svelte-ignore state_referenced_locally
  let left = $state(game.timeLeft || game.seconds * 1000);
  // svelte-ignore state_referenced_locally
  let paused = $state(startPaused);
  const secs = $derived(Math.ceil(left / 1000));
  const late = $derived(secs <= 10);

  // A tap this soon after a card (or the resumed screen) appears is the tail of a double tap,
  // so it must not mark the new card.
  const GUARD_MS = 400;
  let shownAt = performance.now();
  // svelte-ignore state_referenced_locally
  let lastWord = game.card?.word;
  $effect.pre(() => {
    if (game.card?.word !== lastWord) { lastWord = game.card?.word; shownAt = performance.now(); }
  });

  let flash = $state<'buzz' | 'got' | null>(null);
  let flashKey = $state(0);

  onMount(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') pause(); };
    document.addEventListener('visibilitychange', onHide);
    let endAt = performance.now() + left;
    let wasPaused = paused;
    let lastSec = Math.ceil(left / 1000);
    let raf = 0;
    const loop = () => {
      const now = performance.now();
      if (paused) wasPaused = true;
      else {
        if (wasPaused) { endAt = now + left; wasPaused = false; }
        left = Math.max(0, endAt - now);
        const sec = Math.ceil(left / 1000);
        if (sec !== lastSec) {
          lastSec = sec;
          ontick(left);
          if (sec > 0 && sec <= 10) { sfx.tick(); haptic.light(); }
        }
        if (left <= 0) {
          [0, 160, 320].forEach((t) => setTimeout(() => sfx.warn(), t));
          haptic.end();
          ontimeup();
          return;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onHide); };
  });

  function pause() {
    if (paused) return;
    paused = true;
    ontick(left);
  }

  function resume() {
    unlockAudio();
    paused = false;
    shownAt = performance.now();
  }

  function press(m: Exclude<Mark, 'time'>) {
    if (paused || performance.now() - shownAt < GUARD_MS) return;
    if (m === 'got') { sfx.correct(); haptic.correct(); }
    else if (m === 'buzz') { sfx.buzzer(); haptic.pass(); }
    else { sfx.pass(); haptic.light(); }
    flash = m === 'skip' ? null : m;
    flashKey++;
    onmark(m);
  }

  const clock = $derived(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);
</script>

<div class="turn t{team}" class:hidden={paused} style:--team={teamColor(team)} style:--rival={teamColor(rival)} style:--accent={teamColor(team)}>
  <header>
    <button class="icon-btn" onclick={pause} aria-label="Pause">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
    </button>
    <p class="who"><b>{game.names[team]}</b><span class="pts" class:neg={pts < 0}>{pts > 0 ? '+' : ''}{pts} this turn</span></p>
    <div class="clock" class:late role="timer" aria-label="{secs} seconds left">{clock}</div>
  </header>
  <div class="bar" aria-hidden="true"><span style:width="{(left / total) * 100}%" class:late></span></div>

  {#key game.card?.word}
    <section class="card pop-in" aria-label="Describe this">
      <p class="label">Describe</p>
      <div class="word"><FitText text={game.card?.word ?? ''} max={96} min={28} /></div>
      <p class="label no">Don't say</p>
      <ul class="banned">
        {#each game.card?.banned ?? [] as b (b)}<li>{b}</li>{/each}
      </ul>
    </section>
  {/key}

  <div class="pad">
    <button class="buzz" onclick={() => press('buzz')} aria-label="Buzz: a banned word was said, minus 1">
      <span class="big" aria-hidden="true">✗</span><span>Buzz</span><small>{game.names[rival]}: banned word said</small>
    </button>
    <button class="got" onclick={() => press('got')} aria-label="Got it, plus 1">
      <span class="big" aria-hidden="true">✓</span><span>Got it</span>
    </button>
    <button class="skip" onclick={() => press('skip')} aria-label="Skip{game.skipCost ? ', minus 1' : ''}">
      <span aria-hidden="true">↷</span> Skip{game.skipCost ? ' (−1)' : ''}
    </button>
  </div>
</div>

{#if flash}
  {#key flashKey}<div class="flash {flash}" aria-hidden="true" onanimationend={() => (flash = null)}></div>{/key}
{/if}

{#if paused}
  <GameMenu {game} solid title="Paused" note="The clock is stopped at {clock}." resume="Resume" onclose={resume} {onhome} {onend} />
{/if}

<style>
  .turn {
    position: relative; isolation: isolate;
    min-height: 100dvh; max-width: 640px; margin: 0 auto;
    display: flex; flex-direction: column; gap: var(--s-3);
    padding: calc(var(--safe-top) + var(--s-3)) calc(var(--safe-right) + var(--s-4)) calc(var(--safe-bottom) + var(--s-4)) calc(var(--safe-left) + var(--s-4));
    -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
  }
  .turn::before {
    content: ''; position: fixed; inset: 0; z-index: -1; pointer-events: none;
    background: radial-gradient(80% 40% at 50% -5%, color-mix(in srgb, var(--team) 18%, transparent), transparent 70%), var(--bg);
  }
  .turn.hidden .card { visibility: hidden; }
  header { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); }
  .icon-btn { width: 48px; height: 48px; border-radius: var(--r-pill); border: 0; background: var(--surface); color: var(--text); display: grid; place-items: center; flex: none; }
  .who { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; line-height: 1.15; }
  .who b { color: var(--team); font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .pts { font-size: 0.85rem; font-weight: 700; color: var(--text-dim); font-variant-numeric: tabular-nums; }
  .pts.neg { color: var(--bad-ink); }
  .clock {
    flex: none; min-width: 84px; height: 48px; padding: 0 var(--s-3); border-radius: var(--r-pill); display: grid; place-items: center;
    background: var(--surface); font-family: var(--font-display); font-weight: 800; font-size: 1.6rem; font-variant-numeric: tabular-nums;
  }
  .clock.late { color: var(--c-bad); background: color-mix(in srgb, var(--c-bad) 16%, var(--surface)); animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { transform: scale(1.08); } }
  .bar { height: 6px; border-radius: var(--r-pill); background: var(--surface); overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--team); border-radius: inherit; }
  .bar span.late { background: var(--c-bad); }

  .card {
    flex: 1 1 300px; min-height: 280px; display: flex; flex-direction: column; gap: var(--s-2);
    padding: var(--s-3) var(--s-4) var(--s-4); border-radius: var(--r-lg);
    background: var(--bg-raised); border: 2px solid color-mix(in srgb, var(--c-taboo) 55%, transparent);
    box-shadow: var(--shadow);
  }
  .label { text-align: center; font-size: 0.78rem; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text-faint); }
  .label.no { color: var(--c-taboo); padding-top: var(--s-2); border-top: 2px dashed color-mix(in srgb, var(--c-taboo) 40%, transparent); }
  .word { flex: 1 1 90px; min-height: 90px; position: relative; color: var(--text); }
  .banned { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; text-align: center; }
  .banned li { font-family: var(--font-display); font-weight: 700; font-size: clamp(1.2rem, 5.4vw, 1.5rem); line-height: 1.25; color: var(--text-dim); }

  .pad { display: grid; grid-template-columns: 2fr 3fr; grid-template-rows: 1fr auto; gap: var(--s-2); }
  .pad button {
    border: 0; border-radius: var(--r-lg); font-family: var(--font-display); font-weight: 800; display: flex; align-items: center; justify-content: center;
    transition: transform var(--dur-fast) var(--ease-out), filter var(--dur-fast) ease;
  }
  .pad button:active { transform: scale(0.96); filter: brightness(1.1); }
  .big { font-size: 2rem; line-height: 1; }
  .buzz {
    grid-row: 1 / 3; flex-direction: column; gap: 2px; padding: var(--s-2); min-height: 150px; font-size: 1.5rem;
    background: color-mix(in srgb, var(--c-bad) 20%, var(--surface)); color: var(--c-bad);
    border: 2px solid color-mix(in srgb, var(--c-bad) 60%, transparent) !important;
  }
  .buzz small { font-family: var(--font-body); font-size: 0.75rem; font-weight: 700; color: var(--text-dim); line-height: 1.2; text-align: center; overflow-wrap: anywhere; }
  .got { min-height: 96px; gap: var(--s-2); font-size: 1.7rem; background: var(--c-good); color: var(--on-accent); }
  .skip { min-height: var(--tap); gap: var(--s-2); font-size: 1.15rem; background: var(--surface); color: var(--text); }

  /* A phone on its side: the card on the left at full height, the buttons on the right. */
  @media (orientation: landscape) and (max-height: 500px) {
    .turn {
      height: 100dvh; max-width: 960px; display: grid; column-gap: var(--s-5); row-gap: var(--s-2);
      grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr);
      padding-bottom: calc(var(--safe-bottom) + var(--s-2));
    }
    header, .bar { grid-column: 1 / -1; }
    .card { grid-column: 1; grid-row: 3; min-height: 0; gap: var(--s-1); padding: var(--s-2) var(--s-3) var(--s-3); }
    .word { flex: 1 1 auto; min-height: 44px; }
    .label.no { padding-top: var(--s-1); }
    .banned li { font-size: clamp(1rem, 4.6dvh, 1.35rem); line-height: 1.2; }
    .pad { grid-column: 2; grid-row: 3; min-height: 0; }
    .buzz { min-height: 0; }
    .got { min-height: 0; }
  }

  .flash { position: fixed; inset: 0; z-index: 20; pointer-events: none; animation: flash 450ms ease-out both; }
  .flash.buzz { background: color-mix(in srgb, var(--c-bad) 55%, transparent); }
  .flash.got { background: color-mix(in srgb, var(--c-good) 30%, transparent); animation-duration: 300ms; }
  @keyframes flash { from { opacity: 1; } to { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .clock.late { animation: none; } .flash { animation-duration: 600ms; } }
</style>
