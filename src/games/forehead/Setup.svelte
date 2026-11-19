<script lang="ts">
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Segmented from './Segmented.svelte';
  import { wordDecks } from '../../lib/content';
  import { go } from '../../lib/router.svelte';
  import { sfx } from '../../lib/sound';
  import { haptic } from '../../lib/haptics';
  import { prefs, savePrefs, selectedDecks, type Control } from './state.svelte';
  import { ROUND_LENGTHS } from './round';
  import { startRound } from './flow';

  const decks = wordDecks();
  // Drop selections of decks that were deleted since.
  prefs.deckIds = prefs.deckIds.filter((id) => decks.some((d) => d.id === id));

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

<Screen title="Hot Head" accent="var(--c-forehead)" onback={() => go('/')}>
  <ol class="how" aria-label="How to play">
    <li><span class="step" aria-hidden="true">🤯</span><span>Phone on your forehead, screen facing out</span></li>
    <li><span class="step" aria-hidden="true">🗣️</span><span>Friends shout clues — no saying the word</span></li>
    <li><span class="step" aria-hidden="true">↕️</span><span><b class="good">Tilt down</b> if you got it, <b class="pass">tilt up</b> to pass</span></li>
  </ol>

  <section class="stack">
    <div class="sec-head">
      <h3>Decks <span class="faint count">{chosen.length ? `${chosen.length} picked · ${wordCount} words` : 'pick one or more'}</span></h3>
      <button class="link" onclick={() => go('/forehead/decks')}>My decks</button>
    </div>
    <ul class="grid">
      {#each decks as d, i (d.id)}
        {@const on = prefs.deckIds.includes(d.id)}
        <li class="pop-in" style:animation-delay="{Math.min(i, 12) * 25}ms">
          <button class="deck" class:on aria-pressed={on} onclick={() => toggleDeck(d.id)}>
            <span class="emoji" aria-hidden="true">{d.emoji || '🃏'}</span>
            <span class="name">{d.name}</span>
            <span class="meta">{d.custom ? 'Mine · ' : ''}{d.words.length} words</span>
            <span class="check" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </button>
        </li>
      {/each}
      <li>
        <button class="deck make" onclick={() => go('/forehead/make')}>
          <span class="emoji" aria-hidden="true">✨</span>
          <span class="name">Make a deck</span>
          <span class="meta">any theme, with Claude</span>
        </button>
      </li>
    </ul>
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
        ? 'Tilt the phone to score. Tapping the screen works too: right side got it, left side pass.'
        : 'No tilting: tap the right side for got it, the left side to pass.'}
    </p>
  </section>

  {#snippet actions()}
    <Button size="lg" disabled={wordCount === 0} onclick={start}>{startLabel}</Button>
  {/snippet}
</Screen>

<style>
  .how { list-style: none; margin: 0; padding: var(--s-3) var(--s-4); display: flex; flex-direction: column; gap: var(--s-2);
    background: color-mix(in srgb, var(--accent) 10%, var(--bg-raised)); border: 1.5px solid color-mix(in srgb, var(--accent) 30%, transparent);
    border-radius: var(--r-lg); }
  .how li { display: flex; align-items: center; gap: var(--s-3); font-size: 1rem; }
  .step { font-size: 1.4rem; width: 1.8rem; text-align: center; flex: none; }
  .good { color: var(--c-good); }
  .pass { color: var(--c-pass); }
  .sec-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--s-3); }
  .count { font-family: var(--font-body); font-weight: 500; font-size: 0.9rem; letter-spacing: 0; margin-left: var(--s-1); }
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
  .check {
    position: absolute; top: var(--s-2); right: var(--s-2); width: 26px; height: 26px; border-radius: 50%;
    display: grid; place-items: center; background: var(--accent); color: var(--on-accent);
    transform: scale(0); transition: transform var(--dur) var(--ease-spring);
  }
  .on .check { transform: scale(1); }
  .make { background: transparent; border: 2px dashed var(--line-strong); }
  .make .name { color: var(--accent); }
</style>
