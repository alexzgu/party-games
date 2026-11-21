<script lang="ts">
  // A few seconds of confetti in team and game colours; skipped when motion is reduced.
  import { onMount } from 'svelte';
  let { colors }: { colors: string[] } = $props();
  let canvas: HTMLCanvasElement;

  onMount(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = (canvas.width = innerWidth * dpr), h = (canvas.height = innerHeight * dpr);
    const css = getComputedStyle(canvas);
    const palette = colors.map((c) => (c.startsWith('var(') ? css.getPropertyValue(c.slice(4, -1)).trim() || '#fff' : c));
    const bits = Array.from({ length: 160 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3, y: h * 0.35,
      vx: (Math.random() - 0.5) * 18 * dpr, vy: (-Math.random() * 16 - 6) * dpr,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      s: (6 + Math.random() * 7) * dpr, c: palette[Math.floor(Math.random() * palette.length)],
    }));
    let raf = 0;
    const start = performance.now();
    const frame = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const b of bits) {
        b.vy += 0.45 * dpr; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r);
        ctx.fillStyle = b.c; ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2);
        ctx.restore();
      }
      if (t - start < 4500) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  });
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  canvas { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: var(--z-float); }
</style>
