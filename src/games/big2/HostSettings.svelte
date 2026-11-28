<script lang="ts">
  import { untrack } from 'svelte';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import { DEAL_COUNTS, TURN_TIMES } from './logic';
  import { loadSettings } from './store';
  import { host } from './host.svelte';

  // The room's rules: deals per game and seconds per turn. Saved on this device at once and into
  // the lobby's game; a game already running keeps its own.
  let { onback }: { onback: () => void } = $props();
  const saved = loadSettings();
  let deals = $state(saved.deals);
  let seconds = $state(saved.seconds);
  const locked = host.game !== null && host.game.phase !== 'lobby';

  $effect(() => {
    const next = { deals, seconds };
    untrack(() => host.settings(next));
  });
</script>

<Screen title="Room settings" {onback}>
  {#if locked}<p class="note">A game is running: this applies to the next one.</p>{/if}
  <div class="opts">
    <section class="opt" aria-labelledby="big2-deals">
      <h3 id="big2-deals">Deals per game</h3>
      <Segmented label="Deals per game" bind:value={deals} options={DEAL_COUNTS.map((v) => ({ value: v as number, label: `${v}` }))} />
      <p class="hint">Points add up over the deals; the fewest wins.</p>
    </section>
    <section class="opt" aria-labelledby="big2-time">
      <h3 id="big2-time">Seconds per turn</h3>
      <Segmented label="Seconds per turn" bind:value={seconds} options={TURN_TIMES.map((v) => ({ value: v as number, label: v ? `${v}` : 'No limit' }))} />
      <p class="hint">When time runs out, the game passes for that player, or plays their lowest card when they lead. With no limit, the host's Play for them button does it.</p>
    </section>
  </div>
  {#snippet actions()}<Button size="lg" onclick={onback}>Done</Button>{/snippet}
</Screen>

<style>
  .opts { display: grid; gap: var(--s-2); }
  .opt { display: flex; flex-direction: column; gap: var(--s-2); background: var(--surface); border-radius: var(--r-md); padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4); }
  .hint { color: var(--text-faint); font-size: 0.88rem; }
  .note { margin-bottom: var(--s-3); padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: color-mix(in srgb, var(--c-pass) 14%, var(--surface)); font-weight: 600; }
</style>
