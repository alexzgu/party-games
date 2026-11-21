<script lang="ts">
  import type { Snippet } from 'svelte';
  import { sfx } from '../lib/sound';
  import { haptic } from '../lib/haptics';
  import { TAP_GUARD_MS, tapGuard } from '../lib/tapGuard';

  let {
    variant = 'primary',
    size = 'md',
    disabled = false,
    type = 'button',
    label,
    guardMs = TAP_GUARD_MS,
    onclick,
    children,
  }: {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'md' | 'lg' | 'sm';
    disabled?: boolean;
    type?: 'button' | 'submit';
    label?: string;
    /** Clicks this soon after the button appears are ignored: the second tap of a double
     *  tap must not press the next screen's button sitting in the same spot. */
    guardMs?: number;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  } = $props();

  // svelte-ignore state_referenced_locally
  const ready = tapGuard(guardMs);

  function click(e: MouseEvent) {
    if (!ready()) return;
    sfx.tap();
    haptic.light();
    onclick?.(e);
  }
</script>

<button class="btn {variant} {size}" {type} {disabled} aria-label={label} onclick={click}>
  {@render children()}
</button>

<style>
  .btn {
    display: inline-flex; align-items: center; justify-content: center; gap: var(--s-2);
    min-height: var(--tap); padding: 0 var(--s-5);
    border-radius: var(--r-pill); border: 0;
    font-family: var(--font-display); font-weight: 700; font-size: 1.1rem; letter-spacing: -0.01em;
    transition: transform var(--dur-fast) var(--ease-out), background var(--dur) ease, opacity var(--dur) ease;
    width: 100%;
  }
  .btn:active:not(:disabled) { transform: scale(0.97); }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .lg { min-height: 68px; font-size: 1.35rem; }
  .sm { min-height: 44px; font-size: 0.98rem; padding: 0 var(--s-4); width: auto; }
  .primary { background: var(--accent); color: var(--on-accent); box-shadow: 0 8px 24px color-mix(in srgb, var(--accent) calc(35% * var(--glow)), transparent); }
  .secondary { background: var(--surface); color: var(--text); }
  .ghost { background: transparent; color: var(--text-dim); }
  .danger { background: color-mix(in srgb, var(--c-bad) 18%, var(--surface)); color: var(--on-danger); }
</style>
