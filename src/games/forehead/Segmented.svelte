<script lang="ts" generics="T extends string | number">
  import { sfx } from '../../lib/sound';
  import { haptic } from '../../lib/haptics';

  // A row of mutually exclusive options; the chosen one is filled with the accent.
  let { value = $bindable(), options, label, onchange }: {
    value: T;
    options: { value: T; label: string }[];
    label: string;
    onchange?: () => void;
  } = $props();

  function pick(v: T) {
    if (v === value) return;
    value = v;
    sfx.tick();
    haptic.light();
    onchange?.();
  }
</script>

<div class="seg" role="radiogroup" aria-label={label}>
  {#each options as o (o.value)}
    <button role="radio" aria-checked={o.value === value} class:on={o.value === value} onclick={() => pick(o.value)}>{o.label}</button>
  {/each}
</div>

<style>
  .seg { display: flex; gap: 4px; padding: 4px; background: var(--bg-sunk); border-radius: var(--r-pill); border: 1.5px solid var(--line); }
  button {
    flex: 1; min-height: 48px; border: 0; border-radius: var(--r-pill); background: transparent; color: var(--text-dim);
    font-family: var(--font-display); font-weight: 700; font-size: 1.05rem;
    transition: background var(--dur) var(--ease-out), color var(--dur) ease, transform var(--dur-fast) var(--ease-out);
  }
  button:active { transform: scale(0.96); }
  .on { background: var(--accent); color: var(--on-accent); }
</style>
