<script module lang="ts">
  // Where the reading is, kept while the app stays open: back from the pack settings carries on
  // unless the picked questions changed.
  let kept: { key: string; order: string[]; i: number } | null = null;
</script>

<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import { ratherPacks } from '../../lib/content';
  import { back, go } from '../../lib/router.svelte';
  import { keepAwake } from '../../lib/wakelock';
  import { ratherKey } from './rules';
  import { roomQuestions } from './pack';
  import { loadSettings } from './store';
  import Choices from './Choices.svelte';
  import Rules from './Rules.svelte';

  // One phone, read aloud: "Would you rather" and the two choices large in their colours; the room
  // picks with a show of hands. The picked packs' questions as a room asks them (pack.ts: only the
  // picks, Classic when none of them exists), shuffled; Next and Previous; at the end, Start over.
  // No players, no scores, no History.
  const { packs } = loadSettings();
  const shuffled = () => roomQuestions(ratherPacks(), packs);
  const first = shuffled();
  // The questions themselves, so a pack edited or deleted meanwhile starts a new reading.
  const key = first.map(ratherKey).sort().join('\n');
  // svelte-ignore state_referenced_locally
  let reading = $state(kept?.key === key ? kept : { key, order: first, i: 0 });
  const done = $derived(reading.i >= reading.order.length);
  $effect(() => { kept = { ...reading }; });
  $effect(() => {
    keepAwake(true);
    return () => keepAwake(false);
  });

  const move = (by: number) => { reading.i = Math.max(0, Math.min(reading.order.length, reading.i + by)); };
  const again = () => { reading = { key, order: shuffled(), i: 0 }; };
</script>

<Screen title={gameName('rather')} onback={() => back('/rather')}>
  {#snippet trailing()}<HowTo><Rules /></HowTo>{/snippet}
  <div class="aloud">
    {#if !reading.order.length}
      <h2>No questions</h2>
      <p class="muted">The picked packs are empty. Pick packs with questions.</p>
    {:else if done}
      <h2>That’s every question</h2>
      <p class="muted">You’ve been through all {reading.order.length} in the picked packs.</p>
      <Button size="lg" onclick={again}>Start over</Button>
    {:else}
      <h2>Would you rather…</h2>
      {#key reading.i}<div class="pop-in"><Choices prompt={reading.order[reading.i]} size="md" /></div>{/key}
      <p class="count" aria-live="polite">{reading.i + 1} of {reading.order.length}</p>
      <p class="muted hands">Read it out. Hands up for each side.</p>
    {/if}
    <Button size="sm" variant="ghost" onclick={() => go('/rather/settings')} tip="Pick the question packs">Packs</Button>
  </div>
  {#snippet actions()}
    {#if reading.order.length && !done}
      <div class="nav">
        <Button size="lg" variant="secondary" disabled={reading.i === 0} onclick={() => move(-1)} label="Previous question">Previous</Button>
        <Button size="lg" onclick={() => move(1)} label="Next question">Next</Button>
      </div>
    {:else if done}
      <Button size="lg" variant="secondary" onclick={() => move(-1)} label="Previous question">Previous</Button>
    {/if}
  {/snippet}
</Screen>

<style>
  .aloud { display: grid; gap: var(--s-3); }
  h2 { text-align: center; }
  .count { text-align: center; font: 800 1.2rem / 1 var(--font-display); color: var(--text-dim); }
  .hands { text-align: center; }
  .nav { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-3); }
</style>
