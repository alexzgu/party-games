<script lang="ts">
  import { onDestroy } from 'svelte';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Triage from '../../components/Triage.svelte';
  import PasteList from '../../components/PasteList.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import WizardEffort from '../../components/WizardEffort.svelte';
  import { customGibberish, isBuiltin, slugify, type GibberishCard, type GibberishPack } from '../../lib/content';
  import { hasKey, WANTS } from '../../lib/claude';
  import MagicWords from '../../components/MagicWords.svelte';
  import WizardRequest from '../../components/WizardRequest.svelte';
  import PackNameField from '../../components/PackNameField.svelte';
  import { PackName } from '../../lib/packName.svelte';
  import { wizardBlurb } from '../../lib/wizardAsk';
  import { sfx } from '../../lib/sound';
  import { generateCards, THEME_CHIPS } from './generate';
  import { answerKey, parsePastedCards } from './parse';
  import { afterRun, passedSoFar, shareWizardPack } from '../../lib/library';

  // "Make a pack": paste a list, or tell Fizzwick what you want and watch his cards stream in;
  // name the pack, drop the duds, save as a pack.
  let { onsaved, onback, demoItems = null, demoNoKey = false }: {
    onsaved: (packId: string) => void;
    onback: () => void;
    demoItems?: GibberishCard[] | null;
    demoNoKey?: boolean;
  } = $props();

  const myPacks: GibberishPack[] = customGibberish.all();
  const keyed = $derived(!demoNoKey && (hasKey() || !!demoItems));

  // svelte-ignore state_referenced_locally
  let items = $state<GibberishCard[]>(demoItems ?? []);
  // svelte-ignore state_referenced_locally
  let reviewing = $state(!!demoItems);
  /** What the player asked Fizzwick for, kept whole while the review is on screen. */
  // svelte-ignore state_referenced_locally
  let theme = $state(demoItems ? 'Movies' : '');
  /** A new pack's name: Fizzwick's on the review screen, or typed for a pasted list. */
  const packName = new PackName();
  // svelte-ignore state_referenced_locally
  if (demoItems) packName.begin(theme, 'My pack');
  let dest = $state('new');
  let streaming = $state(false);
  let error = $state('');
  let ctrl: AbortController | null = null;

  const destPack = $derived(myPacks.find((p) => p.id === dest));

  const MODES = [{ value: 'paste' as const, label: 'Paste', tip: 'Type or paste your own, one per line' }, { value: 'claude' as const, label: '🧙 Wizard', tip: 'Fizzwick writes cards from what you ask for' }];
  // svelte-ignore state_referenced_locally
  let mode = $state<'paste' | 'claude'>(keyed ? 'claude' : 'paste');
  let pasteText = $state('');
  let note = $state('');

  function pasted(list: GibberishCard[], skipped: string) {
    items = list;
    note = skipped;
    error = '';
    reviewing = true;
  }

  /** Whether everything the wizard put on screen came through a magic-words pass (shared only then). */
  let byPass = false;
  async function run() {
    byPass = passedSoFar(byPass, items.length);
    if (!theme.trim()) return;
    // A new pack gets a name; cards added to one of mine need none.
    if (!destPack) packName.begin(theme, 'My pack');
    const onName = !destPack && packName.wanted ? (s: string) => packName.suggest(s) : undefined;
    reviewing = true;
    error = '';
    streaming = true;
    ctrl = new AbortController();
    const signal = ctrl.signal;
    const before = items.length;
    try {
      await generateCards({
        theme,
        existing: [...$state.snapshot(items), ...(destPack?.cards ?? [])],
        onName,
        onCard: (c) => { items.push(c); sfx.tick(); },
        signal,
      });
      if (!signal.aborted && items.length === before) error = 'No usable cards came back. Try again or ask for something else.';
    } catch (e) {
      error = (e as Error).message;
    } finally {
      streaming = false;
      ctrl = null;
    }
  }

  function cancel() {
    if (streaming) { ctrl?.abort(); return; }
    items = [];
    error = '';
    note = '';
    reviewing = false;
    packName.reset();
  }

  function uniqueId(name: string): string {
    let base = slugify(name);
    if (isBuiltin(base, 'gibberish')) base = 'my-' + base;
    let id = base;
    for (let n = 2; myPacks.some((p) => p.id === id); n++) id = `${base}-${n}`;
    return id;
  }

  /** What the wizard made, or the pack it added to, goes to the Community library whole. */
  const passMade = () => mode === 'claude' && byPass; // pasted items were not made through a pass
  const share = (pack: GibberishPack) => void shareWizardPack('gibberish', pack, passMade());

  function save(kept: GibberishCard[]) {
    const cards = kept.map((c) => ({ ...c }));
    if (destPack) {
      const have = new Set(destPack.cards.map(answerKey));
      const pack = afterRun({ ...destPack, cards: [...destPack.cards, ...cards.filter((c) => !have.has(answerKey(c)))] }, passMade(), false);
      customGibberish.put(pack);
      share(pack);
      onsaved(destPack.id);
    } else {
      const name = mode === 'paste' ? packName.value.trim() || 'My pack' : packName.saved(theme, 'My pack');
      const id = uniqueId(name);
      const blurb = mode === 'paste' ? 'Pasted list' : wizardBlurb(theme.trim() || name);
      const pack = afterRun<GibberishPack>({ id, name, blurb, cards }, passMade(), true);
      customGibberish.put(pack);
      share(pack);
      onsaved(id);
    }
    sfx.correct();
  }

  onDestroy(() => ctrl?.abort());
</script>

{#snippet saveTo()}
  {#if myPacks.length}
    <label class="dest">
      <span>Save to</span>
      <select bind:value={dest}>
        <option value="new">A new pack</option>
        {#each myPacks as p (p.id)}<option value={p.id}>Add to “{p.name}”</option>{/each}
      </select>
    </label>
  {/if}
{/snippet}

<Screen title="Make a pack" onback={() => { ctrl?.abort(); onback(); }}>
  {#if !reviewing}
    <Segmented label="How to make it" options={MODES} bind:value={mode} />
  {/if}
  {#if !reviewing && mode === 'paste'}
    <PasteList submit="Review cards" label="Phrase | Answer | Category (optional)"
      placeholder={'Eye Scream | Ice Cream | Food\nSand A Claws | Santa Claus | Holiday\nHair Eye Pot Her | Harry Potter'}
      parse={(t) => parsePastedCards(t, destPack?.cards ?? [])} onadd={pasted} bind:text={pasteText}>
      {@render saveTo()}
    </PasteList>
  {:else if !reviewing && !keyed}
    <MagicWords intro={WANTS} demo={demoNoKey} />
  {:else if !reviewing}
    <form class="theme" onsubmit={(e) => { e.preventDefault(); void run(); }}>
      <WizardRequest id="gibberish-request" bind:value={theme} placeholder="e.g. famous 90s movies and the stars in them, nothing too obscure" />
      <div class="chips" role="group" aria-label="Ideas">
        {#each THEME_CHIPS as c (c)}
          <button type="button" class="chip" class:on={theme === c} onclick={() => (theme = c)}>{c}</button>
        {/each}
      </div>
      {@render saveTo()}
      <WizardEffort />
      <p class="faint small">Fizzwick writes about 24 cards. You keep the good ones.</p>
      <Button type="submit" size="lg" disabled={!theme.trim()} tip="Fizzwick writes them; you choose which to keep">✨ Make cards</Button>
    </form>
  {:else}
    {#if !destPack}
      <PackNameField name={packName} />
    {:else}
      <p class="muted">Adding to <b>{destPack.name}</b></p>
    {/if}
    {#if note}<p class="faint small">{note}</p>{/if}

    {#if error}
      <div class="error" role="alert">
        <p>{error}</p>
        {#if !streaming}<Button variant="secondary" size="sm" onclick={run}>Try again</Button>{/if}
      </div>
    {/if}

    {#if items.length === 0 && streaming}
      <p class="waiting"><span class="dot" aria-hidden="true"></span> Fizzwick is conjuring your cards…</p>
    {/if}

    <Triage {items} keyOf={answerKey} {streaming} wizard={mode === 'claude'} onsave={save} oncancel={cancel} onmore={mode === 'claude' ? run : undefined}>
      {#snippet item(c)}
        <span class="it">
          <span class="ph">{c.phrase}</span>
          <span class="an">→ {c.answer}</span>
          {#if c.hint}<span class="hi">{c.hint}</span>{/if}
        </span>
      {/snippet}
    </Triage>
  {/if}
</Screen>

<style>
  .small { font-size: 0.9rem; }
  .theme { display: flex; flex-direction: column; gap: var(--s-3); }
  .chips { display: flex; flex-wrap: wrap; gap: var(--s-2); }
  .chip { min-height: 44px; padding: 0 var(--s-4); border-radius: var(--r-pill); border: 1.5px solid var(--line-strong); background: var(--surface); font-weight: 600; }
  .chip.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 22%, var(--surface)); }
  .dest { display: flex; flex-direction: column; gap: var(--s-1); font-weight: 600; color: var(--text-dim); }
  .error { display: flex; flex-direction: column; gap: var(--s-2); align-items: flex-start; padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: color-mix(in srgb, var(--c-bad) 16%, var(--surface)); }
  .waiting { display: flex; align-items: center; gap: var(--s-2); color: var(--text-dim); }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.3; transform: scale(0.7); } }
  .it { display: flex; flex-direction: column; }
  .ph { font-family: var(--font-display); font-weight: 800; font-size: 1.1rem; line-height: 1.15; }
  .an { color: var(--text-dim); font-weight: 600; }
  .hi { color: var(--text-faint); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em; }
</style>
