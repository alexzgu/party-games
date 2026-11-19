<script lang="ts">
  // The big draining clock: a full ring empties clockwise, amber past half time, red with a
  // pulse in the last stretch. At zero it reads "Time!" instead of a number.
  let { left, total, done = false }: { left: number; total: number; done?: boolean } = $props();
  const R = 86;
  const C = 2 * Math.PI * R;
  const secs = $derived(Math.ceil(left / 1000));
  const frac = $derived(done ? 0 : total > 0 ? Math.max(0, Math.min(1, left / total)) : 0);
  const tone = $derived(done ? 'bad' : frac <= 0.3 ? 'bad' : frac <= 0.6 ? 'warn' : 'ok');
</script>

<div class="ring {tone}" class:done role="timer" aria-label={done ? 'Time is up' : `${secs} seconds left`}>
  <svg viewBox="0 0 200 200" aria-hidden="true">
    <circle class="track" cx="100" cy="100" r={R} />
    <circle class="bar" cx="100" cy="100" r={R} stroke-dasharray={C} stroke-dashoffset={C * (1 - frac)} />
  </svg>
  {#if done}
    <span class="time pop-in">Time!</span>
  {:else}
    <span class="secs">{secs}</span>
  {/if}
</div>

<style>
  .ring {
    position: relative; display: grid; place-items: center; aspect-ratio: 1; width: 100%; --c: var(--accent);
    container-type: inline-size;
  }
  .ring.warn { --c: var(--c-pass); }
  .ring.bad { --c: var(--c-bad); }
  .ring.bad:not(.done) { animation: pulse 0.5s ease-in-out infinite alternate; }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); overflow: visible; }
  circle { fill: none; stroke-width: 18; }
  .track { stroke: var(--surface-hi); }
  .bar { stroke: var(--c); stroke-linecap: round; filter: drop-shadow(0 0 10px color-mix(in srgb, var(--c) calc(60% * var(--glow)), transparent)); }
  .done .bar { opacity: 0; }
  .secs, .time { position: relative; font-family: var(--font-display); font-weight: 800; color: var(--c); line-height: 1; font-variant-numeric: tabular-nums; }
  .secs { font-size: 46cqi; letter-spacing: -0.04em; }
  .time { font-size: 24cqi; letter-spacing: -0.02em; }
  @keyframes pulse { to { transform: scale(1.05); } }
  @media (prefers-reduced-motion: reduce) { .ring.bad:not(.done) { animation: none; } }
</style>
