<script lang="ts">
  // A short burst of paper confetti for points and wins. Hidden when motion is reduced.
  import { playerColor } from './ui';
  let { count = 40 }: { count?: number } = $props();
  // svelte-ignore state_referenced_locally
  const pieces = Array.from({ length: count }, (_, i) => ({
    x: Math.random() * 100,
    delay: Math.random() * 0.35,
    dur: 1.3 + Math.random() * 1.1,
    drift: (Math.random() - 0.5) * 140,
    spin: (Math.random() - 0.5) * 1440,
    w: 7 + Math.random() * 7,
    round: i % 4 === 0,
    color: playerColor(i),
  }));
</script>

<div class="confetti" aria-hidden="true">
  {#each pieces as p, i (i)}
    <i
      class:round={p.round}
      style:left="{p.x}%"
      style:width="{p.w}px"
      style:height="{p.round ? p.w : p.w * 0.45}px"
      style:background={p.color}
      style:animation-delay="{p.delay}s"
      style:animation-duration="{p.dur}s"
      style:--drift="{p.drift}px"
      style:--spin="{p.spin}deg"
    ></i>
  {/each}
</div>

<style>
  .confetti { position: fixed; inset: 0; pointer-events: none; overflow: hidden; z-index: 20; }
  i { position: absolute; top: -20px; border-radius: 2px; opacity: 0; animation: fall linear forwards; }
  i.round { border-radius: 50%; }
  @keyframes fall {
    0% { opacity: 1; transform: translate(0, 0) rotate(0); }
    85% { opacity: 1; }
    100% { opacity: 0; transform: translate(var(--drift), 105vh) rotate(var(--spin)); }
  }
  @media (prefers-reduced-motion: reduce) { .confetti { display: none; } }
</style>
