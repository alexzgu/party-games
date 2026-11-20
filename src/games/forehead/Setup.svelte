<script lang="ts">
  import { gameName } from '../../app.config';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import HowTo from '../../components/HowTo.svelte';
  import ListTools from '../../components/ListTools.svelte';
  import type { SortKey } from '../../lib/listing';
  import { customDecks, wordDecks } from '../../lib/content';
  import { go } from '../../lib/router.svelte';
  import { sfx } from '../../lib/sound';
  import { haptic } from '../../lib/haptics';
  import { prefs, savePrefs, selectedDecks, type Control } from './state.svelte';
  import { ROUND_LENGTHS } from './round';
  import { startRound } from './flow';
  import { calibration } from './calibration.svelte';
  import { findDecks } from './find';

  const decks = wordDecks();
  // Drop selections of decks that were deleted since.
  prefs.deckIds = prefs.deckIds.filter((id) => decks.some((d) => d.id === id));

  let query = $state('');
  let sort = $state<SortKey>('suggested');
  /** The tiles on show; the count and Start always cover every picked deck, shown or not. */
  const shown = $derived(findDecks(decks, query, sort));

  const chosen = $derived(selectedDecks(prefs.deckIds));
  const wordCount = $derived(chosen.reduce((n, d) => n + d.words.length, 0));

  const lengths = ROUND_LENGTHS.map((s) => ({ value: s as number, label: s < 120 ? `${s}s` : '2 min' }));
  const controls: { value: Control; label: string }[] = [
    { value: 'tilt', label: '📱 Tilt' },
    { value: 'tap', label: '👆 Tap' },
  ];

  function toggleDeck(id: string) {
    const on = prefs.deckIds.includes(id);
    prefs.deckIds = on ? prefs.deckIds.filter((x) => x !== id) : [...prefs.deckIds, id];
    savePrefs();
    sfx.tick();
    haptic.light();
  }

  function start() {
    startRound($state.snapshot(prefs.deckIds), prefs.seconds, prefs.control);
  }

  const startLabel = $derived(
    chosen.length === 0 ? 'Pick a deck' : wordCount === 0 ? 'Those decks have no words yet' : chosen.length === 1 ? `Start · ${chosen[0].name}` : `Start · ${chosen.length} decks mixed`,
  );
</script>

<Screen title={gameName('forehead')} accent="var(--c-forehead)" onback={() => go('/')}>
  {#snippet trailing()}
    <HowTo>
      <ol>
        <li>Hold the phone sideways on your forehead, screen facing out.</li>
        <li>The countdown starts once the phone is steady.</li>
        <li>Your friends shout clues. They can't say the word itself.</li>
        <li><b>Tilt down</b> when you get it. <b>Tilt up</b> to pass.</li>
        <li>Rather tap? Your right hand taps <b>Got it</b>, your left hand taps <b>Pass</b>. Each side is labelled on its edge.</li>
        <li>Score as many as you can before the timer runs out. Pick the round length below.</li>
        <li>Tilted the wrong way? Tap the word on the results screen to fix it.</li>
      </ol>
    </HowTo>
  {/snippet}

  <section>
    <ListTools key="forehead:setup" bind:query bind:sort placeholder="Search decks or words" shown={shown.length} total={decks.length}>
      {#snippet title()}
        <h3>Decks</h3>
        <p class="faint count">{chosen.length ? `${chosen.length} picked · ${wordCount} words` : 'pick one or more'}</p>
      {/snippet}
      {#snippet extra()}
        <button class="link" onclick={() => go('/forehead/decks')}>Edit decks</button>
      {/snippet}
    </ListTools>
    <ul class="grid">
      {#each shown as { deck: d, via }, i (d.id)}
        {@const on = prefs.deckIds.includes(d.id)}
        <li class="pop-in" style:animation-delay="{Math.min(i, 12) * 25}ms">
          <button class="deck" class:on aria-pressed={on} onclick={() => toggleDeck(d.id)}>
            <span class="emoji" aria-hidden="true">{d.emoji || '🃏'}</span>
            <span class="name">{d.name}</span>
            <span class="meta">{d.custom ? 'Mine · ' : customDecks.isEdited(d.id) ? 'Edited · ' : ''}{d.words.length} words</span>
            {#if via}<span class="via">has “{via}”</span>{/if}
            <span class="check" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </button>
        </li>
      {/each}
      {#if !query.trim()}
        <li>
          <button class="deck make" onclick={() => go('/forehead/make')}>
            <span class="emoji" aria-hidden="true">✨</span>
            <span class="name">Make a deck</span>
            <span class="meta">paste a list or ask Claude</span>
          </button>
        </li>
      {/if}
    </ul>
    {#if !shown.length && query.trim()}<p class="faint none">No decks match “{query.trim()}”</p>{/if}
  </section>

  <section class="stack">
    <h3>Round length</h3>
    <Segmented label="Round length" options={lengths} bind:value={prefs.seconds} onchange={savePrefs} />
  </section>

  <section class="stack">
    <h3>Controls</h3>
    <Segmented label="Controls" options={controls} bind:value={prefs.control} onchange={savePrefs} />
    <p class="faint small">
      {prefs.control === 'tilt'
        ? 'Tilt the phone to score. Tapping works too: right hand got it, left hand pass.'
        : 'No tilting: tap with your right hand for got it, your left hand to pass.'}
    </p>
    {#if prefs.control === 'tilt'}
      <Button variant="secondary" onclick={() => go('/forehead/calibrate')}>
        {calibration.th ? 'Calibrate tilt again (new player?)' : 'Calibrate tilt (half a minute)'}
      </Button>
    {/if}
  </section>

  {#snippet actions()}
    <Button size="lg" disabled={wordCount === 0} onclick={start}>{startLabel}</Button>
  {/snippet}
</Screen>

<style>
  .count { font-size: 0.85rem; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .link { border: 0; background: transparent; color: var(--accent); font-weight: 700; min-height: 44px; padding: 0 var(--s-2); }
  .small { font-size: 0.9rem; }
  .grid { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--s-2); }
  .deck {
    position: relative; width: 100%; height: 100%; min-height: 96px; text-align: left;
    display: flex; flex-direction: column; justify-content: flex-end; gap: 1px;
    padding: var(--s-3); border-radius: var(--r-md); border: 2px solid transparent; background: var(--surface);
    transition: transform var(--dur-fast) var(--ease-out), background var(--dur) ease, border-color var(--dur) ease;
  }
  .deck:active { transform: scale(0.96); }
  .deck.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 20%, var(--surface)); }
  .emoji { font-size: 1.7rem; line-height: 1.1; margin-bottom: var(--s-1); }
  .name { font-family: var(--font-display); font-weight: 800; font-size: 1.08rem; line-height: 1.1; letter-spacing: -0.01em; }
  .meta { color: var(--text-faint); font-size: 0.82rem; }
  .via { color: var(--text-dim); font-size: 0.8rem; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .none { text-align: center; padding: var(--s-2) 0; }
  .check {
    position: absolute; top: var(--s-2); right: var(--s-2); width: 26px; height: 26px; border-radius: 50%;
    display: grid; place-items: center; background: var(--accent); color: var(--on-accent);
    transform: scale(0); transition: transform var(--dur) var(--ease-spring);
  }
  .on .check { transform: scale(1); }
  .make { background: transparent; border: 2px dashed var(--line-strong); }
  .make .name { color: var(--accent); }
</style>
