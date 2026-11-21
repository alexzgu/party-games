<script lang="ts">
  import { onDestroy } from 'svelte';
  import Button from '../../components/Button.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Triage from '../../components/Triage.svelte';
  import WizardEffort from '../../components/WizardEffort.svelte';
  import MagicWords from '../../components/MagicWords.svelte';
  import { hasKey, WANTS } from '../../lib/claude';
  import type { TabooCard } from '../../lib/content';
  import { sfx } from '../../lib/sound';
  import { cardId } from './cards';
  import { generateCards, MAKE_RANGE, THEME_CHIPS } from './generate';

  // "🧙 Ask the wizard" on a new pack: a theme and a size, then Fizzwick's cards stream into
  // Triage; the kept ones become the pack. `taken` is every word already on the phone.
  let { taken, reviewing = $bindable(false), onsave }: {
    taken: () => string[];
    reviewing?: boolean;
    onsave: (name: string, theme: string, cards: TabooCard[]) => void;
  } = $props();

  let theme = $state('');
  let count = $state(MAKE_RANGE.start);
  let name = $state('');
  let items = $state<TabooCard[]>([]);
  let streaming = $state(false);
  let error = $state('');
  let ctrl: AbortController | null = null;
  onDestroy(() => ctrl?.abort());

  async function run() {
    if (!theme.trim()) return;
    if (!name.trim()) name = theme.trim().replace(/^\w/, (c) => c.toUpperCase()).slice(0, 40);
    reviewing = true;
    error = '';
    streaming = true;
    const c = (ctrl = new AbortController());
    try {
      const avoid = [...items.map((x) => x.word), ...taken()];
      const n = await generateCards({ theme, count, avoid, onCard: (x) => { items.push(x); sfx.tick(); }, signal: c.signal });
      if (!c.signal.aborted && n === 0) error = 'No usable cards came back. Try again or pick another theme.';
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
  }
</script>

{#if !reviewing && !hasKey()}
  <MagicWords intro={WANTS} />
{:else if !reviewing}
  <form class="stack" onsubmit={(e) => { e.preventDefault(); void run(); }}>
    <label for="taboo-theme"><h3>What should the cards be about?</h3></label>
    <input id="taboo-theme" type="text" bind:value={theme} placeholder="e.g. our college, 2000s TV, camping" autocomplete="off" enterkeyhint="go" maxlength="80" />
    <div class="chips" role="group" aria-label="Quick themes">
      {#each THEME_CHIPS as t (t)}
        <button type="button" class="chip" class:on={theme === t} onclick={() => (theme = t)}>{t}</button>
      {/each}
    </div>
    <Stepper label="How many cards" bind:value={count} min={MAKE_RANGE.min} max={MAKE_RANGE.max} step={MAKE_RANGE.step} />
    <WizardEffort />
    <p class="faint small">Each card comes with its five banned words. You keep the good ones.</p>
    <Button type="submit" size="lg" disabled={!theme.trim()}>✨ Make {count} cards</Button>
  </form>
{:else}
  <label class="name">
    <span>Pack name</span>
    <input type="text" bind:value={name} placeholder="My pack" maxlength="40" autocomplete="off" />
  </label>
  {#if error}
    <div class="error" role="alert">
      <p>{error}</p>
      {#if !hasKey()}<MagicWords intro={WANTS} />{:else if !streaming}<Button variant="secondary" size="sm" onclick={run}>Try again</Button>{/if}
    </div>
  {/if}
  {#if items.length === 0 && streaming}
    <p class="waiting"><span class="dot" aria-hidden="true"></span> Fizzwick is conjuring “{theme}” cards…</p>
  {/if}
  <Triage {items} keyOf={cardId} {streaming} onsave={(kept) => onsave(name, theme, kept)} oncancel={cancel} onmore={hasKey() ? run : undefined}>
    {#snippet item(c: TabooCard)}<span class="txt"><span class="w">{c.word}</span><span class="b">{c.banned.join(' · ')}</span></span>{/snippet}
  </Triage>
{/if}

<style>
  h3 { font-size: 1.3rem; }
  .small { font-size: 0.9rem; }
  .chips { display: flex; flex-wrap: wrap; gap: var(--s-2); }
  .chip { min-height: 44px; padding: 0 var(--s-4); border-radius: var(--r-pill); border: 1.5px solid var(--line-strong); background: var(--surface); font-weight: 600; }
  .chip.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 22%, var(--surface)); }
  .name { display: flex; flex-direction: column; gap: var(--s-1); font-weight: 600; color: var(--text-dim); }
  .error { display: flex; flex-direction: column; gap: var(--s-2); align-items: flex-start; padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: color-mix(in srgb, var(--c-bad) 16%, var(--surface)); }
  .waiting { display: flex; align-items: center; gap: var(--s-2); color: var(--text-dim); }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.3; transform: scale(0.7); } }
  .txt { display: flex; flex-direction: column; gap: 2px; text-align: left; }
  .w { font-weight: 800; font-family: var(--font-display); }
  .b { font-size: 0.85rem; color: var(--text-faint); }
</style>
