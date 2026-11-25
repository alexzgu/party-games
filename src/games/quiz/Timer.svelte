<script lang="ts">
  // A countdown chip for a host who wants one: it sits in a place the play screen keeps free for
  // it (under the scores) until the host drags it somewhere else; a double tap on its grip puts it
  // back there (Enter on the grip too). Cosmetic: it never changes
  // scores or play. Tap the time to start or pause, ↺ to reset, the length to change
  // it (10/20/30/60 s), × to hide (the ⏱ in the board's header brings it back). A new clue resets
  // it to full without starting it.
  import Floating from '../../components/Floating.svelte';
  import { countdown, reset, running, timeLeft, toggle, type Countdown } from '../../lib/countdown';
  import { sfx } from '../../lib/sound';
  import { haptic } from '../../lib/haptics';
  import { LENGTHS, saveTimer, timer } from './timer.svelte';

  let { clue }: { /** The open tile, or null on the board: a new one resets the clock. */ clue: number | null } = $props();

  let c = $state<Countdown>(countdown(timer.seconds * 1000));
  let now = $state(performance.now());
  let lastClue: number | null = null;

  $effect(() => {
    if (clue !== null && clue !== lastClue) c = reset(c, timer.seconds * 1000);
    lastClue = clue;
  });

  // Ticks while running; at zero a buzzer (if sound is on) and a light buzz, once.
  $effect(() => {
    if (c.since === null) return;
    let done = false;
    const id = setInterval(() => {
      now = performance.now();
      if (!done && timeLeft(c, now) <= 0) {
        done = true;
        sfx.buzzer();
        haptic.light();
      }
    }, 100);
    return () => clearInterval(id);
  });

  const left = $derived(timeLeft(c, now));
  const up = $derived(c.since !== null && left <= 0);
  const on = $derived(running(c, now));
  const secs = $derived(Math.ceil(left / 1000));
  const shown = $derived(up ? 'Time!' : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);

  // A drag ends by setting the position: remember it.
  $effect(() => {
    void timer.pos?.x;
    void timer.pos?.y;
    saveTimer();
  });

  function tap() {
    now = performance.now();
    c = toggle(c, now);
    sfx.tap();
  }
  function restart() {
    c = reset(c, timer.seconds * 1000);
    now = performance.now();
  }
  function nextLength() {
    timer.seconds = LENGTHS[(LENGTHS.indexOf(timer.seconds as (typeof LENGTHS)[number]) + 1) % LENGTHS.length];
    saveTimer();
    restart();
  }
  /** Back under the scores by keyboard or screen reader; a finger or mouse double taps (Floating). */
  function dockByKey(e: MouseEvent) {
    if (e.detail === 0) timer.pos = null;
  }
  function hide() {
    timer.shown = false;
    saveTimer();
  }
</script>

<Floating bind:pos={timer.pos} dock label="Timer">
  <div class="chip" class:on class:up>
    <button class="grip" data-bare onclick={dockByKey} aria-label="Put the timer back under the scores" data-tip="Drag to move the timer; double tap here to put it back under the scores"></button>
    <button class="time" onclick={tap} aria-label={up ? "Time's up. Tap to start again" : on ? `Pause the timer, ${shown} left` : `Start the timer, ${shown}`} data-tip={up ? 'Starts the timer again' : on ? 'Pauses the timer' : 'Starts the timer'}>
      {shown}
    </button>
    <button class="small" onclick={nextLength} aria-label="Timer length {timer.seconds} seconds. Tap to change" data-tip="Changes the timer's length and resets it">{timer.seconds}s</button>
    <button class="small" onclick={restart} aria-label="Reset the timer">↺</button>
    <button class="small x" onclick={hide} aria-label="Hide the timer">×</button>
  </div>
</Floating>

<style>
  .chip {
    display: flex; align-items: center; gap: 4px; padding: 4px;
    border-radius: var(--r-lg); background: var(--bg-raised);
    border: 2px solid var(--line-strong); box-shadow: var(--shadow);
  }
  .chip.on { border-color: var(--accent); }
  .chip.up { border-color: var(--c-bad); }
  .grip { align-self: stretch; min-width: 28px; padding: 0; border: 0; border-radius: var(--r-sm); background: transparent; display: grid; place-items: center; cursor: inherit; }
  .grip::before { content: ''; width: 12px; height: 32px; background: radial-gradient(circle, var(--text-faint) 1.5px, transparent 2px) 0 0 / 6px 8px; }
  .time {
    min-width: 104px; min-height: var(--tap-lg); padding: 0 var(--s-3); border: 0; border-radius: var(--r-md);
    background: var(--surface); color: var(--text);
    font-family: var(--font-display); font-weight: 800; font-size: 2rem; font-variant-numeric: tabular-nums; letter-spacing: -0.02em;
  }
  .on .time { color: var(--accent); }
  .up .time { color: var(--c-bad); animation: pulse 0.9s ease-in-out infinite; }
  .small {
    min-width: var(--tap-min); min-height: var(--tap-lg); padding: 0 4px; border: 0; border-radius: var(--r-sm);
    background: transparent; color: var(--text-dim); font-weight: 800; font-size: 0.95rem;
  }
  .x { font-size: 1.5rem; }
  /* A phone on its side: a slimmer chip, so it fits beside the board under the scores;
     the grip runs along its top. */
  @media (orientation: landscape) and (max-height: 500px) {
    .chip { display: grid; grid-template-columns: repeat(4, auto); row-gap: 0; }
    .grip { grid-column: 1 / -1; min-height: 20px; }
    .grip::before { width: 36px; height: 8px; background-size: 6px 4px; }
    .time { min-width: 80px; min-height: var(--tap-sm); font-size: 1.6rem; padding: 0 var(--s-2); }
    .small { min-height: var(--tap-sm); }
  }
  @keyframes pulse { 50% { transform: scale(1.06); } }
  @media (prefers-reduced-motion: reduce) { .up .time { animation: none; } }
</style>
