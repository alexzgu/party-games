<script lang="ts">
  import { onDestroy } from 'svelte';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Triage from '../../components/Triage.svelte';
  import PasteList from '../../components/PasteList.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import WizardEffort from '../../components/WizardEffort.svelte';
  import MagicWords from '../../components/MagicWords.svelte';
  import WizardRequest from '../../components/WizardRequest.svelte';
  import PackNameField from '../../components/PackNameField.svelte';
  import { PackName } from '../../lib/packName.svelte';
  import { wizardBlurb } from '../../lib/wizardAsk';
  import { customSnark, slugify, snarkPacks } from '../../lib/content';
  import { hasKey, WANTS } from '../../lib/claude';
  import { sfx } from '../../lib/sound';
  import { parsePrompts as parse } from './prompts';
  import { generateItems, MAKE_RANGE, THEME_CHIPS } from './generate';
  import { addItems, itemKey, packTexts, type SnarkItem } from './pack';
  import { afterRun, passedSoFar, shareWizardPack } from '../../lib/library';
  import WizardItem from './WizardItem.svelte';

  // "Make a pack": paste a list, one prompt per line (numbers, bullets and quotes dropped), or tell
  // Fizzwick what you want and watch his prompts stream in, each with a stock answer for "Suggest",
  // plus finals for three-line duels; name the pack, drop the duds, save as a new pack.
  let { onsaved, onback }: { onsaved: (id: string) => void; onback: () => void } = $props();

  const MODES = [{ value: 'paste' as const, label: 'Paste', tip: 'Type or paste your own, one per line' }, { value: 'claude' as const, label: '🧙 Wizard', tip: 'Fizzwick writes prompts from what you ask for' }];
  let mode = $state<'paste' | 'claude'>(hasKey() ? 'claude' : 'paste');
  /** A pasted list's name, typed on the paste screen. */
  let name = $state('');
  /** The wizard pack's name, on the review screen. */
  const packName = new PackName();
  /** What the player asked Fizzwick for, kept whole while the review is on screen. */
  let theme = $state('');
  let count = $state(MAKE_RANGE.start);
  let items = $state<SnarkItem[]>([]);
  let reviewing = $state(false);
  let streaming = $state(false);
  let error = $state('');
  let ctrl: AbortController | null = null;
  onDestroy(() => ctrl?.abort());

  function newId(n: string): string {
    const taken = new Set(snarkPacks().map((p) => p.id));
    let id = slugify(n);
    for (let k = 2; taken.has(id); k++) id = `${slugify(n)}-${k}`;
    return id;
  }

  function add(prompts: string[]) {
    const n = name.trim() || 'My prompts';
    const id = newId(n);
    customSnark.put({ id, name: n, blurb: `${prompts.length} prompts`, prompts });
    onsaved(id);
  }

  /** Whether everything the wizard put on screen came through a magic-words pass (shared only then). */
  let byPass = false;
  async function run() {
    byPass = passedSoFar(byPass, items.length);
    if (!theme.trim()) return;
    packName.begin(theme, 'My prompts');
    const onName = packName.wanted ? (s: string) => packName.suggest(s) : undefined;
    reviewing = true;
    error = '';
    streaming = true;
    const c = (ctrl = new AbortController());
    try {
      const avoid = [...items.map((i) => i.prompt), ...snarkPacks().flatMap(packTexts)];
      const n = await generateItems({ theme, count, avoid, onItem: (i) => { items.push(i); sfx.tick(); }, onName, signal: c.signal });
      if (!c.signal.aborted && n === 0) error = 'No usable prompts came back. Try again or ask for something else.';
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
    packName.reset();
  }

  function save(kept: SnarkItem[]) {
    const n = packName.saved(theme, 'My prompts');
    const id = newId(n);
    const pack = afterRun(addItems({ id, name: n, blurb: wizardBlurb(theme), prompts: [] }, $state.snapshot(kept) as SnarkItem[]), byPass, true);
    customSnark.put(pack);
    void shareWizardPack('snark', pack, byPass);
    sfx.correct();
    onsaved(id);
  }
</script>

<Screen title="Make a pack" onback={() => { ctrl?.abort(); onback(); }}>
  {#if !reviewing}
    <Segmented label="How to make it" options={MODES} bind:value={mode} />
  {/if}
  {#if !reviewing && mode === 'paste'}
    <label class="field">
      <span>Pack name</span>
      <input type="text" bind:value={name} maxlength="40" placeholder="Our friend group" autocomplete="off" />
    </label>
    <PasteList submit="Save these" label="One prompt per line" placeholder={'The worst thing to say at brunch\nA terrible name for a group chat\nWhat Dave is really doing on his phone'} {parse} onadd={(list) => add(list)} />
  {:else if !reviewing && !hasKey()}
    <MagicWords intro={WANTS} />
  {:else if !reviewing}
    <form class="stack" onsubmit={(e) => { e.preventDefault(); void run(); }}>
      <WizardRequest id="snark-request" bind:value={theme} placeholder="e.g. living with roommates: chore wars, passive-aggressive notes, a bit cheeky" />
      <div class="chips" role="group" aria-label="Ideas">
        {#each THEME_CHIPS as t (t)}
          <button type="button" class="chip" class:on={theme === t} onclick={() => (theme = t)}>{t}</button>
        {/each}
      </div>
      <Stepper label="How many prompts" bind:value={count} min={MAKE_RANGE.min} max={MAKE_RANGE.max} step={MAKE_RANGE.step} />
      <WizardEffort />
      <p class="faint small">Each prompt comes with a stock answer for “Suggest”, plus a few finals for three-line duels. You keep the good ones.</p>
      <Button type="submit" size="lg" disabled={!theme.trim()} tip="Fizzwick writes them; you choose which to keep">✨ Make {count}</Button>
    </form>
  {:else}
    <PackNameField name={packName} placeholder="My prompts" />
    {#if error}
      <div class="error" role="alert">
        <p>{error}</p>
        {#if !hasKey()}<MagicWords intro={WANTS} />{:else if !streaming}<Button variant="secondary" size="sm" onclick={run}>Try again</Button>{/if}
      </div>
    {/if}
    {#if items.length === 0 && streaming}
      <p class="waiting"><span class="dot" aria-hidden="true"></span> Fizzwick is conjuring your prompts…</p>
    {/if}
    <Triage {items} keyOf={itemKey} {streaming} wizard onsave={save} oncancel={cancel} onmore={hasKey() ? run : undefined}>
      {#snippet item(i: SnarkItem)}<WizardItem {i} />{/snippet}
    </Triage>
  {/if}
</Screen>

<style>
  .small { font-size: 0.9rem; }
  .field { display: flex; flex-direction: column; gap: var(--s-1); font-weight: 600; color: var(--text-dim); }
  .chips { display: flex; flex-wrap: wrap; gap: var(--s-2); }
  .chip { min-height: 44px; padding: 0 var(--s-4); border-radius: var(--r-pill); border: 1.5px solid var(--line-strong); background: var(--surface); font-weight: 600; }
  .chip.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 22%, var(--surface)); }
  .error { display: flex; flex-direction: column; gap: var(--s-2); align-items: flex-start; padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: color-mix(in srgb, var(--c-bad) 16%, var(--surface)); }
  .waiting { display: flex; align-items: center; gap: var(--s-2); color: var(--text-dim); }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.3; transform: scale(0.7); } }
</style>
