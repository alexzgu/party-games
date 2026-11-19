<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import Stage from './Stage.svelte';
  import { SteadyDetector } from '../../lib/tilt';
  import { sfx } from '../../lib/sound';
  import { haptic } from '../../lib/haptics';
  import { motion, onGravity, pinUpright, setRestPitch, stageRotation } from './sensors.svelte';
  import { wakeDevice } from './flow';
  import type { Round } from './round';

  // "Put it on your forehead": the countdown starts by itself once the phone is held
  // sideways, upright and steady, or on a tap anywhere. Then 3-2-1 and the first word.
  // The tap uses click, not pointerdown: on touch screens only click counts as a user gesture
  // for iOS's motion prompt, audio unlock and fullscreen.
  let { round, ongo, oncancel, demoCount = null, rotation }: {
    round: Round;
    ongo: () => void;
    oncancel: () => void;
    demoCount?: number | null;
    rotation?: number;
  } = $props();

  const STEP_MS = 850;
  const MIN_SHOWN_MS = 900;

  let count = $state<number | null>(untrack(() => demoCount));
  let timer: ReturnType<typeof setInterval> | undefined;
  let shownAt = performance.now();
  const steady = new SteadyDetector();
  // A fresh countdown forgets the last holder's resting pitch; only a steady hold sets it.
  setRestPitch(null);
  const tilt = $derived(round.tilt && motion.live);
  // Some browsers (Brave) grant motion but never send a reading: say so instead of waiting.
  let silent = $state(false);
  $effect(() => {
    if (!round.tilt || motion.live) return;
    const t = setTimeout(() => (silent = !motion.live), 1500);
    return () => clearTimeout(t);
  });

  $effect(() =>
    onGravity((g, t) => {
      if (count == null && steady.update(g, t) && performance.now() - shownAt > MIN_SHOWN_MS) {
        pinUpright();
        setRestPitch(steady.baseline());
        begin();
      }
    }),
  );

  function begin() {
    if (count != null) return;
    count = 3;
    sfx.count();
    haptic.light();
    timer = setInterval(() => {
      count = (count ?? 1) - 1;
      if (count > 0) {
        sfx.count();
        haptic.light();
      } else {
        clearInterval(timer);
        sfx.go();
        haptic.correct();
        ongo();
      }
    }, STEP_MS);
  }

  // Switching away mid-countdown cancels it; back on screen, the phone must settle again.
  $effect(() => {
    const hide = () => {
      if (document.visibilityState !== 'hidden' || count == null) return;
      clearInterval(timer);
      count = null;
      steady.reset();
      setRestPitch(null);
      shownAt = performance.now();
    };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  });

  function tap() {
    wakeDevice();
    begin();
  }

  onDestroy(() => clearInterval(timer));
</script>

{#if count != null}
  <Stage rotation={rotation ?? stageRotation()}>
    <div class="count-bg">
      {#key count}
        <span class="num">{count || 'Go!'}</span>
      {/key}
    </div>
  </Stage>
{:else}
  <div class="ready fade-in">
    <!-- The whole screen starts the countdown; the cancel button sits beside it, not inside. -->
    <button class="start-area" aria-label="Start the countdown" onclick={tap}></button>
    <button class="close" aria-label="Cancel round" onclick={oncancel}>
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/></svg>
    </button>

    <div class="main">
      <div class="phone" aria-hidden="true"><span>🤯</span></div>
      <div class="copy">
        <h1>Put it on your forehead</h1>
        <p class="sub">Sideways, screen facing your friends.</p>
      </div>
    </div>

    <div class="legend">
      <div class="key pass">
        <span class="ico" aria-hidden="true">{tilt ? '⬆' : '◀'}</span>
        <span><b>{tilt ? 'Tilt up' : 'Left hand'}</b><br />✗ Pass</span>
      </div>
      <div class="key good">
        <span class="ico" aria-hidden="true">{tilt ? '⬇' : '▶'}</span>
        <span><b>{tilt ? 'Tilt down' : 'Right hand'}</b><br />✓ Got it</span>
      </div>
    </div>

    <p class="hint">
      <span class="dot" aria-hidden="true"></span>
      {#if motion.live}Starts when it's steady, or tap anywhere{:else}Tap anywhere to start{/if}
    </p>
    {#if round.tilt && (motion.denied || silent)}
      <p class="note">
        {motion.denied ? 'Motion is off for this browser' : 'This browser is not sharing tilt (Brave blocks it)'}, so tap the
        screen: right hand got it, left hand pass. For tilt, use Chrome on Android or Safari on iPhone.
      </p>
    {/if}
  </div>
{/if}

<style>
  .ready {
    position: fixed; inset: 0; display: flex; flex-direction: column; justify-content: center; align-items: center;
    gap: clamp(12px, 4vmin, 32px); text-align: center; user-select: none; -webkit-user-select: none;
    padding: calc(var(--safe-top) + 56px) calc(var(--safe-right) + 20px) calc(var(--safe-bottom) + 20px) calc(var(--safe-left) + 20px);
    background:
      radial-gradient(90% 70% at 50% 30%, color-mix(in srgb, var(--accent) calc(45% * var(--glow)), transparent), transparent 75%),
      var(--bg);
  }
  .start-area { position: absolute; inset: 0; border: 0; padding: 0; background: transparent; cursor: pointer; }
  .start-area:focus-visible { outline-offset: -8px; border-radius: var(--r-lg); }
  /* Everything drawn over the start area lets taps fall through to it. */
  .ready > :not(.start-area) { position: relative; pointer-events: none; }
  .ready > .close { position: absolute; pointer-events: auto; }
  .close {
    position: absolute; top: calc(var(--safe-top) + 12px); left: calc(var(--safe-left) + 12px);
    width: 48px; height: 48px; border-radius: 50%; border: 0; display: grid; place-items: center;
    background: var(--overlay-strong); color: var(--text);
  }
  .main { display: flex; flex-direction: column; align-items: center; gap: clamp(10px, 3vmin, 24px); }
  .phone {
    width: clamp(96px, 26vmin, 150px); aspect-ratio: 1.8; border-radius: 22px; display: grid; place-items: center;
    border: 4px solid var(--text); background: var(--accent); box-shadow: 0 16px 40px color-mix(in srgb, var(--accent) calc(45% * var(--glow)), transparent);
    animation: lift 2.4s var(--ease-out) infinite;
  }
  .phone span { font-size: clamp(2rem, 9vmin, 3.2rem); }
  @keyframes lift {
    0%, 100% { transform: translateY(10px) rotate(-4deg); }
    50% { transform: translateY(-10px) rotate(3deg); }
  }
  h1 { font-size: clamp(2.1rem, 9vmin, 3.6rem); max-width: 14ch; }
  .sub { color: var(--text-dim); font-size: clamp(1.05rem, 4vmin, 1.35rem); margin-top: var(--s-2); }
  .legend { display: flex; gap: var(--s-2); justify-content: center; width: min(100%, 420px); }
  .key {
    display: flex; align-items: center; gap: var(--s-3); text-align: left; padding: var(--s-3);
    border-radius: var(--r-md); background: var(--bg-raised); border: 2px solid; flex: 1; min-width: 0; font-size: 1rem; line-height: 1.25;
  }
  .key b { font-family: var(--font-display); font-size: 1.1rem; }
  .key.good { border-color: var(--c-good); }
  .key.pass { border-color: var(--c-pass); }
  .key.good .ico { color: var(--c-good); }
  .key.pass .ico { color: var(--c-pass); }
  .ico { font-size: 1.6rem; }
  .hint { color: var(--text-dim); display: flex; align-items: center; gap: var(--s-2); font-weight: 600; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); animation: pulse 1.1s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.3; transform: scale(0.6); } }
  .note { color: var(--c-pass); max-width: 34ch; font-size: 0.95rem; }

  @media (orientation: landscape) and (max-height: 500px) {
    .ready { flex-direction: row; flex-wrap: wrap; align-content: center; padding-top: calc(var(--safe-top) + 20px); }
    .main { flex-direction: row; text-align: left; }
    .main h1 { max-width: 12ch; }
    .legend { flex-direction: column; width: auto; }
    .hint { flex-basis: 100%; justify-content: center; }
    .note { flex-basis: 100%; max-width: none; }
  }

  .count-bg {
    position: absolute; inset: 0; display: grid; place-items: center;
    background: radial-gradient(70% 70% at 50% 50%, color-mix(in srgb, var(--accent) calc(55% * var(--glow)), var(--bg)), var(--bg));
  }
  .num {
    font-family: var(--font-display); font-weight: 800; color: var(--text); line-height: 1;
    font-size: min(60vmin, 300px); letter-spacing: -0.04em; text-shadow: 0 10px 40px color-mix(in srgb, var(--shade) 35%, transparent);
    animation: count-pop 700ms var(--ease-spring) both;
  }
  @keyframes count-pop {
    from { opacity: 0; transform: scale(1.6); }
    to { opacity: 1; transform: scale(1); }
  }
</style>
