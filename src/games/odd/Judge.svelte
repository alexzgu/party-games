<script lang="ts">
  import { tapGuard } from '../../lib/tapGuard';

  // The room's call on the odd one's guess: two big buttons, words and icons, never colour alone.
  // They appear where Show word was, so taps in their first moments are the tail of a double tap
  // on it: the guard starts when these buttons appear, not when the screen did.
  let { name, onjudge }: { name: string; onjudge: (got: boolean) => void } = $props();
  const ready = tapGuard();
</script>

<div class="judge" role="group" aria-label="Did {name} get it?">
  <button class="call no" onclick={() => ready() && onjudge(false)}><span class="mk" aria-hidden="true">✗</span> Missed</button>
  <button class="call yes" onclick={() => ready() && onjudge(true)}><span class="mk" aria-hidden="true">✓</span> Got it</button>
</div>

<style>
  .judge { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-2); }
  .call {
    --c: var(--c-good); min-height: var(--tap-xxl); border-radius: var(--r-lg); display: flex; align-items: center; justify-content: center; gap: var(--s-2);
    font-family: var(--font-display); font-weight: 800; font-size: 1.35rem; color: var(--text);
    border: 2.5px solid var(--c); background: color-mix(in srgb, var(--c) 20%, var(--surface));
    transition: transform var(--dur-fast) var(--ease-out), background var(--dur-fast) ease;
  }
  .call.no { --c: var(--c-bad); }
  .call:active { transform: scale(0.96); background: color-mix(in srgb, var(--c) 40%, var(--surface)); }
  .mk { color: var(--c); font-size: 1.6rem; line-height: 1; }
</style>
