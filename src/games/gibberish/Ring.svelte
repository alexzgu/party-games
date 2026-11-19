<script lang="ts">
  // Countdown ring: drains clockwise, turns amber at 10 s and red (with a pulse) at 5 s.
  let { left, total, size = 72 }: { left: number; total: number; size?: number } = $props();
  const R = 30;
  const C = 2 * Math.PI * R;
  const secs = $derived(Math.ceil(left / 1000));
  const frac = $derived(total > 0 ? Math.max(0, Math.min(1, left / total)) : 0);
  const tone = $derived(secs <= 5 ? 'bad' : secs <= 10 ? 'warn' : 'ok');
</script>

<div class="ring {tone}" style:width="{size}px" style:height="{size}px" role="timer" aria-label="{secs} seconds left">
  <svg viewBox="0 0 72 72" aria-hidden="true">
    <circle class="track" cx="36" cy="36" r={R} />
    <circle class="bar" cx="36" cy="36" r={R} stroke-dasharray={C} stroke-dashoffset={C * (1 - frac)} />
  </svg>
  <span>{secs}</span>
</div>

<style>
  .ring { position: relative; display: grid; place-items: center; flex: none; --c: var(--accent); }
  .ring.warn { --c: var(--c-pass); }
  .ring.bad { --c: var(--c-bad); animation: pulse 1s ease-in-out infinite; }
  svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
  circle { fill: none; stroke-width: 7; }
  .track { stroke: var(--surface-hi); }
  .bar { stroke: var(--c); stroke-linecap: round; }
  span { font-family: var(--font-display); font-weight: 800; font-size: 1.5rem; font-variant-numeric: tabular-nums; color: var(--c); }
  @keyframes pulse { 50% { transform: scale(1.08); } }
  @media (prefers-reduced-motion: reduce) { .ring.bad { animation: none; } }
</style>
