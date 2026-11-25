<script lang="ts" generics="Pack extends ListPack & PackMeta">
  import { onDestroy } from 'svelte';
  import type { PackGameId } from '../app.config';
  import Screen from './Screen.svelte';
  import Button from './Button.svelte';
  import Stepper from './Stepper.svelte';
  import Triage from './Triage.svelte';
  import PasteList from './PasteList.svelte';
  import Segmented from './Segmented.svelte';
  import WizardEffort from './WizardEffort.svelte';
  import MagicWords from './MagicWords.svelte';
  import WizardRequest from './WizardRequest.svelte';
  import PackNameField from './PackNameField.svelte';
  import WizardChanges from './WizardChanges.svelte';
  import { WizardChanges as Changes } from '../lib/wizardChanges.svelte';
  import { PackName } from '../lib/packName.svelte';
  import { wizardBlurb } from '../lib/wizardAsk';
  import { slugify, type PackMeta } from '../lib/content';
  import { hasKey, WANTS } from '../lib/claude';
  import { sfx } from '../lib/sound';
  import { afterRun, libraryOn, passedSoFar, shareWizardPack } from '../lib/library';
  import { NO_ROOM, putSplit, type AnyPack } from '../lib/packfile';
  import { addItems, itemKey, packItems, parseLists, type ListItem, type ListPack, type ListSpec } from '../lib/listPack';
  import { askLine, changeGame, generateItems, type ListWizard } from '../lib/listWizard';

  // "Make a pack" for a list pack (Doodle Brawl, Bad Hand, Sketchy, Would You Rather, Smarty Pants):
  // paste a list, one item per line (numbers, bullets and quotes dropped), or tell Fizzwick what you
  // want and watch his items stream in; name the pack, drop the duds, save as a new pack.
  let {
    game,
    specs,
    packs,
    wizard,
    range,
    chips,
    route,
    pasteLabel = '',
    pastePlaceholder = '',
    pasteExamples,
    defaultName,
    requestHint,
    onsaved,
    onback,
  }: {
    game: PackGameId;
    specs: readonly ListSpec[];
    packs: () => Pack[];
    wizard: ListWizard;
    range: { start: number; min: number; max: number; step: number };
    chips: readonly string[];
    /** Which list a pasted line goes in; none: the paste box has a switch for it (Sketchy). */
    route?: (line: string) => string;
    pasteLabel?: string;
    /** A few example lines (with `route`). */
    pastePlaceholder?: string;
    /** Without `route`: example lines for each list, by field. */
    pasteExamples?: Record<string, string>;
    defaultName: string;
    /** A descriptive example request for this game, starting "e.g.". */
    requestHint: string;
    /** The packs saved: one, or several when it was too long for one. */
    onsaved: (ids: string[]) => void;
    onback: () => void;
  } = $props();

  const MODES = [{ value: 'paste' as const, label: 'Paste', tip: 'Type or paste your own, one per line' }, { value: 'claude' as const, label: '🧙 Wizard', tip: 'Fizzwick writes a pack from what you ask for' }];
  let mode = $state<'paste' | 'claude'>(hasKey() ? 'claude' : 'paste');
  /** A pasted list's name, typed on the paste screen. */
  let name = $state('');
  /** The wizard pack's name, on the review screen. */
  const packName = new PackName();
  /** What the player asked Fizzwick for, kept whole while the review is on screen. */
  let theme = $state('');
  // svelte-ignore state_referenced_locally
  let count = $state(range.start);
  // svelte-ignore state_referenced_locally
  let pasteField = $state(specs[0].field);
  let items = $state<ListItem[]>([]);
  let reviewing = $state(false);
  let streaming = $state(false);
  let error = $state('');
  /** Why the pack could not be saved; everything on screen stays, to try again. */
  let unsaved = $state('');
  let ctrl: AbortController | null = null;
  onDestroy(() => ctrl?.abort());
  const keyOf = $derived(itemKey(specs));
  const lists = $derived(askLine(wizard, wizard.split(count)));
  const pasteSpec = $derived(specs.find((x) => x.field === pasteField) ?? specs[0]);
  const one = $derived(specs.length > 1 ? 'items' : specs[0].many);

  /** Keys of the items dropped on review. */
  let dropped = $state(new Set<string>());
  /** "Ask for changes" on Fizzwick's items. */
  // svelte-ignore state_referenced_locally
  const changes = new Changes({
    game: changeGame(wizard, range.max), request: () => theme, asked: () => count, avoid: () => packs().flatMap((p) => packItems(specs, p)),
    items: () => items, setItems: (v) => (items = v), dropped: () => dropped, setDropped: (v) => (dropped = v),
    name: () => packName, onItem: () => sfx.tick(), running: () => streaming, onStart: (n) => { byPass = libraryOn(game) && passedSoFar(byPass, n); error = ''; },
  });

  function newId(n: string): string {
    const taken = new Set(packs().map((p) => p.id));
    let id = slugify(n);
    for (let k = 2; taken.has(id); k++) id = `${slugify(n)}-${k}`;
    return id;
  }

  const empty = (id: string, n: string, blurb: string): Pack =>
    ({ id, name: n, blurb, ...Object.fromEntries(specs.map((s) => [s.field, []])) }) as unknown as Pack;

  function add(list: ListItem[]) {
    const n = name.trim() || defaultName;
    const id = newId(n);
    const saved = putSplit(game, addItems(empty(id, n, 'Pasted list'), specs, list));
    if (saved.length) onsaved(saved.map((p) => p.id));
    else unsaved = NO_ROOM;
  }

  /**
   * Whether everything the wizard put on screen came through a magic-words pass (shared only then),
   * in a game the Community library takes: a pack of any other game is never marked for sharing.
   */
  let byPass = false;
  async function run() {
    if (changes.writing) return; // one writer at a time: a change or this run
    changes.newRun();
    byPass = libraryOn(game) && passedSoFar(byPass, items.length);
    if (!theme.trim()) return;
    packName.begin('wizard', theme, defaultName);
    reviewing = true;
    error = '';
    streaming = true;
    const c = (ctrl = new AbortController());
    try {
      const avoid = [...items, ...packs().flatMap((p) => packItems(specs, p))];
      const onName = packName.wanted ? (s: string) => packName.suggest(s) : undefined;
      const n = await generateItems(wizard, { theme, count, avoid, onItem: (i) => { items.push(i); sfx.tick(); }, onName, signal: c.signal });
      if (!c.signal.aborted && n === 0) error = `No usable ${one} came back. Try again or ask for something else.`;
    } catch (e) {
      error = (e as Error).message;
    } finally {
      if (ctrl === c) { streaming = false; ctrl = null; }
    }
  }

  function cancel() {
    if (changes.busy) return changes.stop();
    if (streaming) { ctrl?.abort(); return; }
    items = [];
    error = '';
    reviewing = false;
    packName.reset();
    changes.clear();
  }

  function save(kept: ListItem[]) {
    const n = packName.saved(theme, defaultName);
    const id = newId(n);
    const pack = afterRun(addItems(empty(id, n, wizardBlurb(theme)), specs, $state.snapshot(kept) as ListItem[]), byPass, true);
    const saved = putSplit(game, pack);
    if (!saved.length) { unsaved = NO_ROOM; return; }
    for (const p of saved) void shareWizardPack(game, p as unknown as AnyPack, byPass);
    sfx.correct();
    onsaved(saved.map((p) => p.id));
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
    {#if !route}
      <Segmented label="What you are pasting" bind:value={pasteField} options={specs.map((s) => ({ value: s.field, label: s.many.charAt(0).toUpperCase() + s.many.slice(1) }))} />
      {#if pasteSpec.hint}<p class="faint small">{pasteSpec.hint}</p>{/if}
    {/if}
    {#if unsaved}<div class="error" role="alert"><p>{unsaved}</p></div>{/if}
    <PasteList submit="Save these" label={route ? pasteLabel : `One ${pasteSpec.one} per line`} placeholder={route ? pastePlaceholder : (pasteExamples?.[pasteSpec.field] ?? pasteSpec.example)}
      parse={(text) => parseLists(text, specs, route ?? (() => pasteField))} onadd={(list) => add(list)} />
  {:else if !reviewing && !hasKey()}
    <MagicWords intro={WANTS} />
  {:else if !reviewing}
    <form class="stack" onsubmit={(e) => { e.preventDefault(); void run(); }}>
      <WizardRequest id="{game}-request" bind:value={theme} placeholder={requestHint} />
      <div class="chips" role="group" aria-label="Ideas">
        {#each chips as t (t)}
          <button type="button" class="chip" class:on={theme === t} onclick={() => (theme = t)}>{t}</button>
        {/each}
      </div>
      <Stepper label="How many {specs[0].many}" bind:value={count} min={range.min} max={range.max} step={range.step} />
      <WizardEffort />
      <p class="faint small">Fizzwick writes {lists}. You keep the good ones.</p>
      <Button type="submit" size="lg" disabled={!theme.trim()} tip="Fizzwick writes it; you choose what to keep">✨ Make pack</Button>
    </form>
  {:else}
    <PackNameField name={packName} placeholder={defaultName} />
    {#if error}
      <div class="error" role="alert">
        <p>{error}</p>
        {#if !hasKey()}<MagicWords intro={WANTS} />{:else if !changes.writing}<Button variant="secondary" size="sm" onclick={run}>Try again</Button>{/if}
      </div>
    {/if}
    {#if items.length === 0 && streaming}
      <p class="waiting"><span class="dot" aria-hidden="true"></span> Fizzwick is conjuring your {one}…</p>
    {/if}
    {#if unsaved}<div class="error" role="alert"><p>{unsaved}</p></div>{/if}
    <Triage {items} {keyOf} bind:dropped streaming={changes.writing} stopPutsBack={changes.busy} wizard onsave={save} oncancel={cancel} onmore={hasKey() ? run : undefined}>
      {#snippet below()}<WizardChanges {changes} />{/snippet}
      {#snippet item(i: ListItem)}
        <span class="it">
          {#if specs.length > 1}<span class="tag">{specs.find((s) => s.field === i.field)?.one}</span>{/if}
          <span class="q">{i.text}</span>
        </span>
      {/snippet}
    </Triage>
  {/if}
</Screen>

<style>
  .small { font-size: 0.9rem; margin: 0; }
  .field { display: flex; flex-direction: column; gap: var(--s-1); font-weight: 600; color: var(--text-dim); }
  .chips { display: flex; flex-wrap: wrap; gap: var(--s-2); }
  .chip { min-height: 44px; padding: 0 var(--s-4); border-radius: var(--r-pill); border: 1.5px solid var(--line-strong); background: var(--surface); font-weight: 600; }
  .chip.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 22%, var(--surface)); }
  .error { display: flex; flex-direction: column; gap: var(--s-2); align-items: flex-start; padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: color-mix(in srgb, var(--c-bad) 16%, var(--surface)); }
  .waiting { display: flex; align-items: center; gap: var(--s-2); color: var(--text-dim); }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.3; transform: scale(0.7); } }
  .it { display: flex; flex-direction: column; gap: 2px; text-align: left; }
  .q { font-weight: 700; }
  .tag { align-self: flex-start; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; padding: 1px 6px; border-radius: var(--r-pill); background: var(--surface-hi); color: var(--text-dim); }
</style>
