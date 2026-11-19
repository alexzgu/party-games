<script lang="ts">
  import { sfx } from '../../lib/sound';

  // The room's call after the buzzer: two big buttons, with words and icons, never colour alone.
  // Taps in the first 400 ms are the tail of a tap on the screen before, so they are ignored.
  let { name, onjudge }: { name: string; onjudge: (got: boolean) => void } = $props();
  const shownAt = performance.now();
  const call = (got: boolean) => {
    if (performance.now() - shownAt < 400) return;
    sfx.tap();
    onjudge(got);
  };
</script>

<div class="judge fade-in" role="group" aria-label="Did {name} name 3?">
  <p class="ask">Did <b>{name}</b> name 3?</p>
  <div class="row">
    <button class="call no" onclick={() => call(false)}><span class="icon" aria-hidden="true">✗</span> Didn't</button>
    <button class="call yes" onclick={() => call(true)}><span class="icon" aria-hidden="true">✓</span> Got 3</button>
  </div>
</div>

<style>
  .judge { display: flex; flex-direction: column; gap: var(--s-2); }
  .ask { text-align: center; font-size: 1.15rem; font-weight: 600; color: var(--text-dim); }
  .ask b { color: var(--text); }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-2); }
  .call {
    --c: var(--c-good); min-height: 84px; border-radius: var(--r-lg); display: flex; align-items: center; justify-content: center; gap: var(--s-2);
    font-family: var(--font-display); font-weight: 800; font-size: 1.5rem; color: var(--text);
    border: 2.5px solid var(--c); background: color-mix(in srgb, var(--c) 20%, var(--surface));
    transition: transform var(--dur-fast) var(--ease-out), background var(--dur-fast) ease;
  }
  .call.no { --c: var(--c-bad); }
  .call:active { transform: scale(0.96); background: color-mix(in srgb, var(--c) 40%, var(--surface)); }
  .icon { color: var(--c); font-size: 1.8rem; line-height: 1; }
</style>
