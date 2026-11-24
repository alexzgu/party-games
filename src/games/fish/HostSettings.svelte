<script lang="ts">
  import { untrack } from 'svelte';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import { TURN_TIMES } from './logic';
  import { loadSettings } from './store';
  import { host } from './host.svelte';

  // The room's rules: seconds per turn. Saved on this device at once and into the lobby's game; a
  // game already running keeps its own.
  let { onback }: { onback: () => void } = $props();
  let seconds = $state(loadSettings().seconds);
  const locked = host.game !== null && host.game.phase !== 'lobby';

  $effect(() => {
    const next = { seconds };
    untrack(() => host.settings(next));
  });
</script>

<Screen title="Room settings" {onback}>
  {#if locked}<p class="note">A game is running: this applies to the next one.</p>{/if}
  <section class="opt" aria-labelledby="fish-time">
    <h3 id="fish-time">Seconds per turn</h3>
    <Segmented label="Seconds per turn" bind:value={seconds} options={TURN_TIMES.map((v) => ({ value: v as number, label: v ? `${v}` : 'No limit' }))} />
    <p class="hint">When time runs out, the game asks for that player: a random card of theirs from a random player. With no limit, the host's Ask for them button does it.</p>
  </section>
  {#snippet actions()}<Button size="lg" onclick={onback}>Done</Button>{/snippet}
</Screen>

<style>
  .opt { display: flex; flex-direction: column; gap: var(--s-2); background: var(--surface); border-radius: var(--r-md); padding: var(--s-3) var(--s-3) var(--s-3) var(--s-4); }
  .hint { color: var(--text-faint); font-size: 0.88rem; }
  .note { margin-bottom: var(--s-3); padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: color-mix(in srgb, var(--c-pass) 14%, var(--surface)); font-weight: 600; }
</style>
