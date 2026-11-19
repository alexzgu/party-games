<script lang="ts">
  import { secs } from './look';

  // Seconds left in a ring that empties. Red and pulsing for the last five seconds.
  let { left, total, paused = false, size = 72 }: { left: number | null; total: number; paused?: boolean; size?: number } = $props();
  const s = $derived(secs(left));
  const frac = $derived(left === null || total <= 0 ? 0 : Math.max(0, Math.min(1, left / total)));
  const R = 20;
  const C = 2 * Math.PI * R;
</script>

{#if s !== null}
  <div class="timer" class:low={s <= 5 && !paused} class:paused style:--size="{size}px" role="timer" aria-label="{s} seconds left{paused ? ', paused' : ''}">
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r={R} class="track" />
      <circle cx="24" cy="24" r={R} class="fill" stroke-dasharray={C} stroke-dashoffset={C * (1 - frac)} />
    </svg>
    <span>{paused ? 'II' : s}</span>
  </div>
{/if}

<style>
  .timer { position: relative; width: var(--size); height: var(--size); flex: none; display: grid; place-items: center; }
  svg { position: absolute; inset: 0; transform: rotate(-90deg); }
  circle { fill: none; stroke-width: 4.5; }
  .track { stroke: var(--overlay-strong); }
  .fill { stroke: var(--accent); stroke-linecap: round; transition: stroke-dashoffset 0.25s linear, stroke var(--dur) ease; }
  span { font-family: var(--font-display); font-weight: 800; font-size: calc(var(--size) * 0.38); font-variant-numeric: tabular-nums; }
  .low .fill { stroke: var(--c-bad); }
  .low span { color: var(--c-bad); animation: pulse 1s ease-in-out infinite; }
  .paused span { color: var(--text-dim); }
  @keyframes pulse { 50% { transform: scale(1.12); } }
</style>
