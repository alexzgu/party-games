<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import PackList from '../../components/PackList.svelte';
  import RulesCard from '../../components/RulesCard.svelte';
  import { wordDecks } from '../../lib/content';
  import { back, go } from '../../lib/router.svelte';
  import { prefs, savePrefs, selectedDecks, type Input } from './state.svelte';
  import { ROUND_LENGTHS } from './round';
  import { startRound } from './flow';
  import { calibration } from './calibration.svelte';
  import { deckEntry } from './find';
  import { roundSummary } from './roundSummary';

  let decks = $state.raw(wordDecks());
  // Drop selections of decks that were deleted since.
  prefs.deckIds = prefs.deckIds.filter((id) => decks.some((d) => d.id === id));
  const entries = $derived(decks.map(deckEntry));
  // Every pick (a tap, an import) is kept for next time.
  $effect(() => {
    $state.snapshot(prefs.deckIds);
    savePrefs();
  });

  const chosen = $derived(selectedDecks(prefs.deckIds));
  const wordCount = $derived(chosen.reduce((n, d) => n + d.words.length, 0));

  const lengths = ROUND_LENGTHS.map((s) => ({ value: s as number, label: s < 120 ? `${s}s` : '2 min' }));
  const inputs: { value: Input; label: string }[] = [
    { value: 'tilt', label: '📱 Tilt' },
    { value: 'tap', label: '👆 Tap' },
    { value: 'both', label: 'Both' },
  ];
  const inputHelp: Record<Input, string> = {
    tilt: 'Tilt only: down for got it, up to pass. Taps do nothing (unless this phone cannot feel tilts).',
    tap: 'Tap only: right hand got it, left hand pass. Tilting does nothing.',
    both: 'Tilt or tap, whichever is handy: down or right hand for got it, up or left hand to pass.',
  };

  function start() {
    startRound($state.snapshot(prefs.deckIds), prefs.seconds, prefs.input);
  }

  const startLabel = $derived(
    chosen.length === 0 ? 'Pick a pack' : wordCount === 0 ? 'Those packs have no words yet' : chosen.length === 1 ? `Start · ${chosen[0].name}` : `Start · ${chosen.length} packs mixed`,
  );
</script>

<Screen fill title={gameName('forehead')} accent="var(--c-forehead)" onback={() => back('/games')} backLabel="Games">
  {#snippet trailing()}
    <HowTo>
      <ol>
        <li>Hold the phone sideways on your forehead, screen facing out.</li>
        <li>The countdown starts once the phone is steady.</li>
        <li>Your friends shout clues. They can't say the word itself.</li>
        <li><b>Tilt down</b> when you get it. <b>Tilt up</b> to pass.</li>
        <li>Rather tap? Your right hand taps <b>Got it</b>, your left hand taps <b>Pass</b>. Each side is labelled on its edge.</li>
        <li>Score as many as you can before the timer runs out. Set the round length under Round, just above Start.</li>
        <li>Tilted the wrong way? Tap the word on the results screen to fix it.</li>
      </ol>
    </HowTo>
  {/snippet}

  <PackList game="forehead" entries={entries} bind:selected={prefs.deckIds} noun="words" placeholder="Search packs or words"
    makeHint="Paste a list, type one or ask the wizard"
    onedit={(id) => go('/forehead/deck?id=' + encodeURIComponent(id))} onmake={() => go('/forehead/make')} onimported={() => (decks = wordDecks())} />

  {#snippet actions()}
    <RulesCard compact title="Round" summary={roundSummary(prefs.seconds, prefs.input)}>
      <div class="field">
        <span class="lbl">Round length</span>
        <Segmented label="Round length" options={lengths} bind:value={prefs.seconds} onchange={savePrefs} />
      </div>
      <div class="field">
        <span class="lbl">Controls</span>
        <Segmented label="Controls" options={inputs} bind:value={prefs.input} onchange={savePrefs} />
        <p class="faint small">{inputHelp[prefs.input]}</p>
      </div>
      {#if prefs.input !== 'tap'}
        <Button variant="secondary" onclick={() => go('/forehead/calibrate')} tip="Teaches this phone how you tilt, for reliable scoring">
          {calibration.th ? 'Recalibrate tilt' : 'Calibrate tilt'}
        </Button>
      {/if}
    </RulesCard>
    <Button size="lg" disabled={wordCount === 0} onclick={start}>{startLabel}</Button>
  {/snippet}
</Screen>

<style>
  .small { font-size: 0.9rem; padding: 0 var(--s-1); }
  .field { display: flex; flex-direction: column; gap: var(--s-1); }
  .lbl { font-weight: 600; font-size: 0.92rem; color: var(--text-dim); padding-left: var(--s-1); }
</style>
