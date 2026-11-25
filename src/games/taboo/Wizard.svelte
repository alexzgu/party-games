<script lang="ts">
  import { onDestroy } from 'svelte';
  import Button from '../../components/Button.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Triage from '../../components/Triage.svelte';
  import WizardEffort from '../../components/WizardEffort.svelte';
  import MagicWords from '../../components/MagicWords.svelte';
  import WizardRequest from '../../components/WizardRequest.svelte';
  import PackNameField from '../../components/PackNameField.svelte';
  import { PackName } from '../../lib/packName.svelte';
  import { hasKey, WANTS } from '../../lib/claude';
  import type { TabooCard } from '../../lib/content';
  import { sfx } from '../../lib/sound';
  import { cardId } from './cards';
  import { passedSoFar } from '../../lib/library';
  import { generateCards, MAKE_RANGE, THEME_CHIPS } from './generate';

  // "🧙 Ask the wizard" on a new pack: what the player wants and a size, then Fizzwick's cards
  // stream into Triage under the pack's name; the kept ones become the pack. `taken` is every word
  // already on the phone.
  let { taken, reviewing = $bindable(false), onsave }: {
    taken: () => string[];
    reviewing?: boolean;
    /** `byPass`: every card came through a magic-words pass, so the pack may be shared. */
    /** `request`: what the player asked for, whole. */
    onsave: (name: string, request: string, cards: TabooCard[], byPass: boolean) => void;
  } = $props();

  /** What the player asked Fizzwick for, kept whole while the review is on screen. */
  let theme = $state('');
  let count = $state(MAKE_RANGE.start);
  const name = new PackName();
  let items = $state<TabooCard[]>([]);
  let streaming = $state(false);
  let error = $state('');
  let ctrl: AbortController | null = null;
  onDestroy(() => ctrl?.abort());

  /** Whether everything the wizard put on screen came through a magic-words pass (shared only then). */
  let byPass = false;
  async function run() {
    byPass = passedSoFar(byPass, items.length);
    if (!theme.trim()) return;
    name.begin('wizard', theme, 'My pack');
    const onName = name.wanted ? (s: string) => name.suggest(s) : undefined;
    reviewing = true;
    error = '';
    streaming = true;
    const c = (ctrl = new AbortController());
    try {
      const avoid = [...items.map((x) => x.word), ...taken()];
      const n = await generateCards({ theme, count, avoid, onCard: (x) => { items.push(x); sfx.tick(); }, onName, signal: c.signal });
      if (!c.signal.aborted && n === 0) error = 'No usable cards came back. Try again or ask for something else.';
    } catch (e) {
      error = (e as Error).message;
    } finally {
      if (ctrl === c) { streaming = false; ctrl = null; }
    }
  }

  function cancel() {
    if (streaming) { ctrl?.abort(); return; }
    items = [];
    error = '';
    reviewing = false;
    name.reset();
  }
</script>

{#if !reviewing && !hasKey()}
  <MagicWords intro={WANTS} />
{:else if !reviewing}
  <form class="stack" onsubmit={(e) => { e.preventDefault(); void run(); }}>
    <WizardRequest id="taboo-request" bind:value={theme} placeholder="e.g. summer camp memories: activities, camp food, counselors, nothing too niche" />
    <div class="chips" role="group" aria-label="Ideas">
      {#each THEME_CHIPS as t (t)}
        <button type="button" class="chip" class:on={theme === t} onclick={() => (theme = t)}>{t}</button>
      {/each}
    </div>
    <Stepper label="How many cards" bind:value={count} min={MAKE_RANGE.min} max={MAKE_RANGE.max} step={MAKE_RANGE.step} />
    <WizardEffort />
    <p class="faint small">Each card comes with its five banned words. You keep the good ones.</p>
    <Button type="submit" size="lg" disabled={!theme.trim()} tip="Fizzwick writes them; you choose which to keep">✨ Make {count}</Button>
  </form>
{:else}
  <PackNameField {name} />
  {#if error}
    <div class="error" role="alert">
      <p>{error}</p>
      {#if !hasKey()}<MagicWords intro={WANTS} />{:else if !streaming}<Button variant="secondary" size="sm" onclick={run}>Try again</Button>{/if}
    </div>
  {/if}
  {#if items.length === 0 && streaming}
    <p class="waiting"><span class="dot" aria-hidden="true"></span> Fizzwick is conjuring your cards…</p>
  {/if}
  <Triage {items} keyOf={cardId} {streaming} wizard onsave={(kept) => onsave(name.saved(theme, 'My pack'), theme, kept, byPass)} oncancel={cancel} onmore={hasKey() ? run : undefined}>
    {#snippet item(c: TabooCard)}<span class="txt"><span class="w">{c.word}</span><span class="b">{c.banned.join(' · ')}</span></span>{/snippet}
  </Triage>
{/if}

<style>
  .small { font-size: 0.9rem; }
  .chips { display: flex; flex-wrap: wrap; gap: var(--s-2); }
  .chip { min-height: 44px; padding: 0 var(--s-4); border-radius: var(--r-pill); border: 1.5px solid var(--line-strong); background: var(--surface); font-weight: 600; }
  .chip.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 22%, var(--surface)); }
  .error { display: flex; flex-direction: column; gap: var(--s-2); align-items: flex-start; padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: color-mix(in srgb, var(--c-bad) 16%, var(--surface)); }
  .waiting { display: flex; align-items: center; gap: var(--s-2); color: var(--text-dim); }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.3; transform: scale(0.7); } }
  .txt { display: flex; flex-direction: column; gap: 2px; text-align: left; }
  .w { font-weight: 800; font-family: var(--font-display); }
  .b { font-size: 0.85rem; color: var(--text-faint); }
</style>
