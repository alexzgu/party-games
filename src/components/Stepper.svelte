<script lang="ts">
  import { sfx } from '../lib/sound';
  let { value = $bindable(), min = 0, max = 99, step = 1, format = (v: number) => String(v), label }:
    { value: number; min?: number; max?: number; step?: number; format?: (v: number) => string; label: string } = $props();
  const set = (v: number) => { value = Math.min(max, Math.max(min, v)); sfx.tick(); };
</script>

<div class="stepper" role="group" aria-label={label}>
  <span class="label">{label}</span>
  <div class="ctrl">
    <button type="button" onclick={() => set(value - step)} disabled={value <= min} aria-label="Less">−</button>
    <output aria-live="polite">{format(value)}</output>
    <button type="button" onclick={() => set(value + step)} disabled={value >= max} aria-label="More">+</button>
  </div>
</div>

<style>
  .stepper { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3);
    background: var(--surface); border-radius: var(--r-md); padding: var(--s-2) var(--s-2) var(--s-2) var(--s-4); }
  .label { font-weight: 600; }
  .ctrl { display: flex; align-items: center; gap: var(--s-2); }
  button { width: 48px; height: 48px; border-radius: var(--r-pill); border: 0; background: var(--surface-hi);
    font-size: 1.5rem; font-weight: 700; line-height: 1; }
  button:disabled { opacity: 0.35; }
  output { min-width: 64px; text-align: center; font-family: var(--font-display); font-weight: 800; font-size: 1.3rem; font-variant-numeric: tabular-nums; }
</style>
