<script lang="ts">
  // "Make with Claude": theme → cards stream into Triage → save as a new pack or add to one
  // of yours → optionally ask for more like these, avoiding every card already there.
  import { onDestroy } from 'svelte';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Triage from '../../components/Triage.svelte';
  import { hasKey } from '../../lib/claude';
  import { customSpectra, slugify, type Spectrum, type SpectrumPack } from '../../lib/content';
  import { go } from '../../lib/router.svelte';
  import { generatePairs, THEME_CHIPS } from './generate';
  import { cardId } from './state';
  import { selectPack } from './persist';

  let { onback, onuse, initial = [] }: { onback: () => void; onuse: (packId: string) => void; initial?: Spectrum[] } = $props();

  type Step = 'theme' | 'review' | 'save' | 'saved';
  // svelte-ignore state_referenced_locally
  let step = $state<Step>(initial.length ? 'review' : 'theme');
  let theme = $state('');
  // svelte-ignore state_referenced_locally
  let items = $state<Spectrum[]>(initial.slice());
  let batch = $state(0); // remounts Triage so each new batch starts all-kept
  let streaming = $state(false);
  let error = $state('');
  let kept = $state<Spectrum[]>([]);
  let packName = $state('');
  let savedPack = $state<SpectrumPack | null>(null);
  let controller: AbortController | null = null;
  onDestroy(() => controller?.abort());

  const mine = $derived(step === 'save' ? customSpectra.all() : []);

  async function run(avoid: Spectrum[]) {
    error = '';
    streaming = true;
    controller = new AbortController();
    const seen = new Set([...avoid, ...items].map(cardId));
    try {
      await generatePairs({
        theme,
        avoid,
        signal: controller.signal,
        onPair: (c) => {
          if (seen.has(cardId(c))) return;
          seen.add(cardId(c));
          items = [...items, c];
        },
      });
    } catch (e) {
      error = (e as Error).message;
    } finally {
      streaming = false;
      controller = null;
    }
  }

  function startFresh(t: string) {
    theme = t;
    items = [];
    batch++;
    step = 'review';
    void run([]);
  }

  function more() {
    void run([...(savedPack?.cards ?? []), ...items]);
  }

  function moreLikeSaved() {
    if (!savedPack) return;
    items = [];
    batch++;
    step = 'review';
    void run(savedPack.cards);
  }

  function cancel() {
    if (streaming) { controller?.abort(); return; }
    items = [];
    step = savedPack ? 'saved' : 'theme';
  }

  function onsave(k: Spectrum[]) {
    kept = k;
    if (savedPack) { addTo(savedPack); return; }
    packName = titleCase(theme || 'My pack');
    step = 'save';
  }

  function merge(a: Spectrum[], b: Spectrum[]): Spectrum[] {
    const have = new Set(a.map(cardId));
    return [...a, ...b.filter((c) => !have.has(cardId(c)))];
  }

  function saveNew() {
    const name = packName.trim() || 'My pack';
    const pack: SpectrumPack = { id: `my-${slugify(name)}-${Date.now().toString(36)}`, name, blurb: `Made with Claude: ${theme || name}`, cards: kept, custom: true };
    customSpectra.put(pack);
    finish(pack);
  }

  function addTo(p: SpectrumPack) {
    const pack = { ...p, cards: merge(p.cards, kept) };
    customSpectra.put(pack);
    finish(pack);
  }

  function finish(pack: SpectrumPack) {
    selectPack(pack.id);
    savedPack = pack;
    items = [];
    step = 'saved';
  }

  const titleCase = (s: string) => s.trim().replace(/\b\p{L}/gu, (c) => c.toUpperCase()).slice(0, 40);
</script>

{#snippet savedActions()}
  <Button size="lg" onclick={() => savedPack && onuse(savedPack.id)}>Use it now</Button>
  <Button variant="secondary" onclick={moreLikeSaved}>More like these</Button>
{/snippet}

<Screen title="Make a pack" accent="var(--c-dial)" {onback} backLabel="Back to setup" actions={step === 'saved' ? savedActions : undefined}>
  {#if step === 'theme' && !hasKey()}
    <div class="nokey">
      <p class="big">✨ Claude can write fresh cards for any theme in seconds.</p>
      <p class="muted">It needs an Anthropic API key, pasted once in Settings. The key stays on this phone. The built-in packs work without it.</p>
      <Button onclick={() => go('/settings')}>Open Settings</Button>
    </div>
  {:else if step === 'theme'}
    <form class="stack" onsubmit={(e) => { e.preventDefault(); startFresh(theme); }}>
      <label class="stack">
        <span class="lbl">What should the cards be about?</span>
        <input type="text" maxlength="80" placeholder="e.g. 90s cartoons, our office, wine" bind:value={theme} enterkeyhint="go" />
      </label>
      <Button type="submit" size="lg">Make 20 cards</Button>
    </form>
    <div class="chips" aria-label="Quick themes">
      {#each THEME_CHIPS as c (c)}
        <button class="chip" onclick={() => startFresh(c)}>{c}</button>
      {/each}
    </div>
  {:else if step === 'review'}
    <p class="muted">Theme: <b>{theme || 'More like your pack'}</b>. Tap a card to drop it.</p>
    {#if error}<p class="err" role="alert">{error}</p>{/if}
    {#if error && !streaming && items.length === 0}
      <div class="stack">
        <Button size="lg" onclick={() => void run(savedPack?.cards ?? [])}>Try again</Button>
        <Button variant="ghost" onclick={cancel}>Back</Button>
      </div>
    {:else}
    {#key batch}
      <Triage {items} keyOf={cardId} {streaming} {onsave} oncancel={cancel} onmore={more}>
        {#snippet item(c: Spectrum)}<span class="pair">{c.left} <span class="sep" aria-label="to">↔</span> {c.right}</span>{/snippet}
      </Triage>
    {/key}
    {/if}
  {:else if step === 'save'}
    <div class="stack">
      <h3>Save {kept.length} cards</h3>
      <label class="stack">
        <span class="lbl">New pack name</span>
        <input type="text" maxlength="40" bind:value={packName} />
      </label>
      <Button size="lg" onclick={saveNew}>Save as a new pack</Button>
      {#if mine.length}
        <p class="faint or">or add them to one of yours</p>
        {#each mine as p (p.id)}
          <Button variant="secondary" onclick={() => addTo(p)}>Add to {p.name} ({p.cards.length})</Button>
        {/each}
      {/if}
      <Button variant="ghost" onclick={() => (step = 'review')}>Back to the cards</Button>
    </div>
  {:else if step === 'saved' && savedPack}
    <div class="saved pop-in">
      <p class="tick" aria-hidden="true">✓</p>
      <h2>{savedPack.name}</h2>
      <p class="muted">{savedPack.cards.length} cards, saved on this phone and selected for your next game.</p>
    </div>
  {/if}
</Screen>

<style>
  .nokey { display: flex; flex-direction: column; gap: var(--s-4); padding-top: var(--s-4); }
  .big { font-family: var(--font-display); font-weight: 700; font-size: 1.4rem; line-height: 1.2; }
  .lbl { font-weight: 700; }
  .chips { display: flex; flex-wrap: wrap; gap: var(--s-2); }
  .chip {
    min-height: 44px; padding: 0 var(--s-4); border-radius: var(--r-pill);
    background: var(--surface); border: 1.5px solid var(--line-strong); font-weight: 600;
  }
  .chip:active { background: var(--surface-hi); }
  .err { color: var(--c-bad); font-weight: 600; }
  .pair { font-weight: 600; }
  .sep { color: var(--accent); padding: 0 2px; }
  .or { text-align: center; }
  .saved { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--s-3); padding-top: var(--s-6); }
  .tick {
    width: 84px; height: 84px; border-radius: 50%; display: grid; place-items: center;
    background: var(--c-good); color: var(--bg); font-size: 2.6rem; font-weight: 800;
  }
</style>
