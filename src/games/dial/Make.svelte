<script lang="ts">
  // "Make a pack": paste a list, or tell Fizzwick what you want and watch cards stream in → name
  // the pack and review in Triage → save as a new pack or add to one of yours → add more, avoiding
  // every card there.
  import { onDestroy } from 'svelte';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Triage from '../../components/Triage.svelte';
  import PasteList from '../../components/PasteList.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import WizardEffort from '../../components/WizardEffort.svelte';
  import { hasKey, WANTS } from '../../lib/claude';
  import MagicWords from '../../components/MagicWords.svelte';
  import WizardRequest from '../../components/WizardRequest.svelte';
  import PackNameField from '../../components/PackNameField.svelte';
  import WizardChanges from '../../components/WizardChanges.svelte';
  import { WizardChanges as Changes } from '../../lib/wizardChanges.svelte';
  import { PackName } from '../../lib/packName.svelte';
  import { wizardBlurb } from '../../lib/wizardAsk';
  import { customSpectra, slugify, type Spectrum, type SpectrumPack } from '../../lib/content';
  import { BATCH, CHANGE, generatePairs, parsePastedPairs, THEME_CHIPS } from './generate';
  import { cardId } from './state';
  import { selectPack } from './persist';
  import { afterRun, passedSoFar, shareWizardPack } from '../../lib/library';

  let { onback, onuse, initial = [] }: { onback: () => void; onuse: (packId: string) => void; initial?: Spectrum[] } = $props();

  type Step = 'theme' | 'review' | 'save' | 'saved';
  // svelte-ignore state_referenced_locally
  let step = $state<Step>(initial.length ? 'review' : 'theme');
  /** What the player asked Fizzwick for, kept whole while the review is on screen. */
  let theme = $state('');
  // svelte-ignore state_referenced_locally
  let items = $state<Spectrum[]>(initial.slice());
  let batch = $state(0); // remounts Triage so each new batch starts all-kept
  let streaming = $state(false);
  let error = $state('');
  let kept = $state<Spectrum[]>([]);
  /** A new pack's name: on the review screen for Fizzwick's cards, and on the save step. */
  const packName = new PackName();
  // Cards handed in for review are Fizzwick's: the name field starts with a name.
  // svelte-ignore state_referenced_locally
  if (initial.length) packName.begin('wizard', '', 'My pack');
  let savedPack = $state<SpectrumPack | null>(null);
  let controller: AbortController | null = null;
  onDestroy(() => controller?.abort());

  const MODES = [{ value: 'paste' as const, label: 'Paste', tip: 'Type or paste your own, one per line' }, { value: 'claude' as const, label: '🧙 Wizard', tip: 'Fizzwick writes cards from what you ask for' }];
  // svelte-ignore state_referenced_locally
  let mode = $state<'paste' | 'claude'>(hasKey() || initial.length ? 'claude' : 'paste');
  let pasteText = $state('');
  let note = $state('');

  /** Keys of the cards dropped on review. */
  let dropped = $state(new Set<string>());
  /** "Ask for changes" on Fizzwick's cards: a run asks for one batch, and so does a change. */
  const changes = new Changes({
    game: CHANGE, request: () => theme, asked: () => BATCH, avoid: () => savedPack?.cards ?? [],
    items: () => items, setItems: (v) => (items = v), dropped: () => dropped, setDropped: (v) => (dropped = v),
    name: () => (savedPack ? null : packName), onStart: (n) => (byPass = passedSoFar(byPass, n)),
  });

  /** A new list on review: no marks, no changes. */
  function fresh() {
    batch++;
    dropped = new Set();
    changes.clear();
  }

  function pasted(list: Spectrum[], skipped: string) {
    packName.begin('paste', '', ''); // a pasted list is a new pack: a name typed for another is forgotten
    theme = '';
    items = list;
    note = skipped;
    error = '';
    fresh();
    step = 'review';
  }

  function pasteMore() {
    pasteText = '';
    mode = 'paste';
    step = 'theme';
  }

  const mine = $derived(step === 'save' ? customSpectra.all() : []);

  /** Whether everything the wizard put on screen came through a magic-words pass (shared only then). */
  let byPass = false;
  async function run(avoid: Spectrum[]) {
    changes.settle();
    byPass = passedSoFar(byPass, items.length);
    error = '';
    streaming = true;
    controller = new AbortController();
    const seen = new Set([...avoid, ...items].map(cardId));
    // A new pack gets a name; cards added to the pack just saved need none.
    if (!savedPack) packName.begin('wizard', theme, 'My pack');
    const onName = !savedPack && packName.wanted ? (s: string) => packName.suggest(s) : undefined;
    try {
      await generatePairs({
        theme,
        avoid,
        onName,
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
    fresh();
    step = 'review';
    void run(savedPack?.cards ?? []);
  }

  function more() {
    void run([...(savedPack?.cards ?? []), ...items]);
  }

  function moreLikeSaved() {
    if (!savedPack) return;
    mode = 'claude';
    items = [];
    fresh();
    step = 'review';
    void run(savedPack.cards);
  }

  function cancel() {
    if (changes.busy) return changes.stop();
    if (streaming) { controller?.abort(); return; }
    items = [];
    changes.clear();
    step = savedPack ? 'saved' : 'theme';
    packName.reset();
  }

  function onsave(k: Spectrum[]) {
    kept = k;
    if (savedPack) { addTo(savedPack); return; }
    if (mode === 'paste') packName.begin('paste', '', 'My pack');
    step = 'save';
  }

  function merge(a: Spectrum[], b: Spectrum[]): Spectrum[] {
    const have = new Set(a.map(cardId));
    return [...a, ...b.filter((c) => !have.has(cardId(c)))];
  }

  function saveNew() {
    const name = packName.saved(theme, 'My pack');
    const blurb = mode === 'paste' ? 'Pasted list' : wizardBlurb(theme || name);
    const pack = afterRun<SpectrumPack>({ id: `my-${slugify(name)}-${Date.now().toString(36)}`, name, blurb, cards: kept, custom: true }, passMade(), true);
    customSpectra.put(pack);
    finish(pack);
  }

  function addTo(p: SpectrumPack) {
    const pack = afterRun({ ...p, cards: merge(p.cards, kept) }, passMade(), false);
    customSpectra.put(pack);
    finish(pack);
  }

  /** Whether these cards came through a pass (pasted ones never did). */
  const passMade = () => mode === 'claude' && byPass;

  function finish(pack: SpectrumPack) {
    // What the wizard made, or the pack it added to, goes to the Community library whole.
    void shareWizardPack('dial', pack, passMade());
    selectPack(pack.id);
    savedPack = pack;
    items = [];
    step = 'saved';
  }
</script>

{#snippet savedActions()}
  <Button size="lg" onclick={() => savedPack && onuse(savedPack.id)} tip="Back to setup, with this pack picked">Use now</Button>
  {#if hasKey()}
    <Button variant="secondary" onclick={moreLikeSaved} tip="Fizzwick writes more cards to add to this pack">Add more</Button>
  {:else}
    <Button variant="secondary" onclick={pasteMore} tip="Add another list of cards to this pack">Paste more</Button>
  {/if}
{/snippet}

<Screen title="Make a pack" accent="var(--c-dial)" {onback} backLabel="Back to setup" actions={step === 'saved' ? savedActions : undefined}>
  {#if step === 'theme'}
    <Segmented label="How to make it" options={MODES} bind:value={mode} />
    {#if savedPack}<p class="muted">Adding to <b>{savedPack.name}</b></p>{/if}
  {/if}
  {#if step === 'theme' && mode === 'paste'}
    <PasteList submit="Review cards" label="One per line: Left | Right" placeholder={'Cold | Hot\nUnderrated | Overrated\nCheap | Expensive'}
      parse={(t) => parsePastedPairs(t, savedPack?.cards ?? [])} onadd={pasted} bind:text={pasteText} />
  {:else if step === 'theme' && !hasKey()}
    <MagicWords intro={WANTS} />
  {:else if step === 'theme'}
    <form class="stack" onsubmit={(e) => { e.preventDefault(); startFresh(theme); }}>
      <WizardRequest id="dial-request" bind:value={theme} placeholder="e.g. food and cooking scales that would start arguments at a dinner party" />
      <WizardEffort />
      <Button type="submit" size="lg" tip="Fizzwick writes them; you choose which to keep">Make 20</Button>
    </form>
    <div class="chips" aria-label="Ideas">
      {#each THEME_CHIPS as c (c)}
        <button class="chip" onclick={() => startFresh(c)} data-tip="Asks Fizzwick for cards about this right away">{c}</button>
      {/each}
    </div>
  {:else if step === 'review'}
    {#if mode === 'paste'}
      <p class="muted">Your list. Tap a card to drop it.</p>
      {#if note}<p class="faint note">{note}</p>{/if}
    {:else}
      {#if savedPack}
        <p class="muted">Adding to <b>{savedPack.name}</b>. Tap a card to drop it.</p>
      {:else}
        <PackNameField name={packName} />
        <p class="muted">Tap a card to drop it.</p>
      {/if}
    {/if}
    {#if error}<p class="err" role="alert">{error}</p>{/if}
    {#if error && !streaming && items.length === 0}
      <div class="stack">
        <Button size="lg" onclick={() => void run(savedPack?.cards ?? [])}>Try again</Button>
        <Button variant="ghost" onclick={cancel}>Back</Button>
      </div>
    {:else}
    {#key batch}
      <Triage {items} keyOf={cardId} bind:dropped streaming={streaming || changes.busy} wizard={mode === 'claude'} saveLabel={savedPack ? 'Save' : 'Continue with'} {onsave} oncancel={cancel} onmore={mode === 'claude' ? more : undefined}>
        {#snippet item(c: Spectrum)}<span class="pair">{c.left} <span class="sep" aria-label="to">↔</span> {c.right}</span>{/snippet}
        {#snippet below()}{#if mode === 'claude'}<WizardChanges {changes} request={theme} />{/if}{/snippet}
      </Triage>
    {/key}
    {/if}
  {:else if step === 'save'}
    <div class="stack">
      <h3>Save {kept.length} cards</h3>
      <PackNameField name={packName} />
      <Button size="lg" onclick={saveNew}>New pack</Button>
      {#if mine.length}
        <p class="faint or">or add them to one of yours</p>
        {#each mine as p (p.id)}
          <Button variant="secondary" onclick={() => addTo(p)}>+ {p.name} ({p.cards.length})</Button>
        {/each}
      {/if}
      <Button variant="ghost" onclick={() => (step = 'review')}>Back</Button>
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
  .note { font-size: 0.92rem; }
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
