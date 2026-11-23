<script lang="ts">
  import { onDestroy } from 'svelte';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Triage from '../../components/Triage.svelte';
  import PasteList from '../../components/PasteList.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import WizardEffort from '../../components/WizardEffort.svelte';
  import { customQuick, slugify, type QuickPack } from '../../lib/content';
  import { hasKey, WANTS } from '../../lib/claude';
  import MagicWords from '../../components/MagicWords.svelte';
  import { sfx } from '../../lib/sound';
  import { generatePrompts, THEME_CHIPS } from './generate';
  import { parsePasted } from './parse';
  import { promptKey } from './logic';
  import { afterRun, passedSoFar, shareWizardPack } from '../../lib/library';

  // "Make a pack": paste a list, or pick a theme and watch Claude's prompts stream in; drop the
  // duds, save as a pack.
  let { onsaved, onback, demoItems = null }: {
    onsaved: (packId: string) => void;
    onback: () => void;
    demoItems?: string[] | null;
  } = $props();

  const myPacks: QuickPack[] = customQuick.all();
  const keyed = $derived(hasKey() || !!demoItems);

  // svelte-ignore state_referenced_locally
  let items = $state<string[]>(demoItems ?? []);
  // svelte-ignore state_referenced_locally
  let reviewing = $state(!!demoItems);
  // svelte-ignore state_referenced_locally
  let theme = $state(demoItems ? 'Food & drink' : '');
  // svelte-ignore state_referenced_locally
  let packName = $state(demoItems ? 'Food & drink' : '');
  let dest = $state('new');
  let streaming = $state(false);
  let error = $state('');
  let ctrl: AbortController | null = null;

  const destPack = $derived(myPacks.find((p) => p.id === dest));

  const MODES = [{ value: 'paste' as const, label: 'Paste a list', tip: 'Type or paste your own, one per line' }, { value: 'claude' as const, label: '🧙 Ask the wizard', tip: 'Fizzwick writes prompts on a theme you pick' }];
  // svelte-ignore state_referenced_locally
  let mode = $state<'paste' | 'claude'>(keyed ? 'claude' : 'paste');
  let pasteText = $state('');
  let note = $state('');

  function pasted(list: string[], skipped: string) {
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
    if (!packName.trim()) packName = theme.trim().replace(/^\w/, (c) => c.toUpperCase());
    reviewing = true;
    error = '';
    streaming = true;
    ctrl = new AbortController();
    const signal = ctrl.signal;
    const before = items.length;
    try {
      await generatePrompts({
        theme,
        existing: [...$state.snapshot(items), ...(destPack?.prompts ?? [])],
        onPrompt: (p) => { items.push(p); sfx.tick(); },
        signal,
      });
      if (!signal.aborted && items.length === before) error = 'No usable prompts came back. Try again or pick another theme.';
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
  }

  function uniqueId(name: string): string {
    let base = slugify(name);
    if (customQuick.isBuiltin(base)) base = 'my-' + base;
    let id = base;
    for (let n = 2; myPacks.some((p) => p.id === id); n++) id = `${base}-${n}`;
    return id;
  }

  /** What the wizard made, or the pack it added to, goes to the Community library whole. */
  const passMade = () => mode === 'claude' && byPass; // pasted items were not made through a pass
  const share = (pack: QuickPack) => void shareWizardPack('quick', pack, passMade());

  function save(kept: string[]) {
    if (destPack) {
      const have = new Set(destPack.prompts.map(promptKey));
      const pack = afterRun({ ...destPack, prompts: [...destPack.prompts, ...kept.filter((p) => !have.has(promptKey(p)))] }, passMade(), false);
      customQuick.put(pack);
      share(pack);
      onsaved(destPack.id);
    } else {
      const name = packName.trim() || 'My pack';
      const id = uniqueId(name);
      const blurb = mode === 'paste' ? 'Pasted list' : `Conjured by Fizzwick: ${theme.trim() || name}`;
      const pack = afterRun<QuickPack>({ id, name, blurb, prompts: [...kept] }, passMade(), true);
      customQuick.put(pack);
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
    <PasteList submit="Review prompts" label="One prompt per line. Each reads “Name 3 …”."
      placeholder={"things you'd find in a fridge\nwords that rhyme with night\nsongs by Taylor Swift"}
      parse={(t) => parsePasted(t, destPack?.prompts ?? [])} onadd={pasted} bind:text={pasteText}>
      {@render saveTo()}
    </PasteList>
  {:else if !reviewing && !keyed}
    <MagicWords intro={WANTS} />
  {:else if !reviewing}
    <form class="theme" onsubmit={(e) => { e.preventDefault(); void run(); }}>
      <label for="theme-in"><h3>What should the prompts be about?</h3></label>
      <input id="theme-in" type="text" bind:value={theme} placeholder="e.g. our college, 2000s TV, camping" autocomplete="off" enterkeyhint="go" maxlength="80" />
      <div class="chips" role="group" aria-label="Quick themes">
        {#each THEME_CHIPS as c (c)}
          <button type="button" class="chip" class:on={theme === c} onclick={() => (theme = c)}>{c}</button>
        {/each}
      </div>
      {@render saveTo()}
      <WizardEffort />
      <p class="faint small">Fizzwick writes about 30 prompts. You keep the good ones.</p>
      <Button type="submit" size="lg" disabled={!theme.trim()} tip="Fizzwick writes them; you choose which to keep">✨ Make prompts</Button>
    </form>
  {:else}
    {#if !destPack}
      <label class="name">
        <span>Pack name</span>
        <input type="text" bind:value={packName} placeholder="My pack" maxlength="40" autocomplete="off" />
      </label>
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
      <p class="waiting"><span class="dot" aria-hidden="true"></span> Fizzwick is conjuring “{theme}” prompts…</p>
    {/if}

    <Triage {items} keyOf={promptKey} {streaming} onsave={save} oncancel={cancel} onmore={mode === 'claude' ? run : undefined}>
      {#snippet item(p)}<span class="it"><span class="lead">Name 3</span> {p}</span>{/snippet}
    </Triage>
  {/if}
</Screen>

<style>
  h3 { font-size: 1.3rem; }
  .small { font-size: 0.9rem; }
  .theme { display: flex; flex-direction: column; gap: var(--s-3); }
  .chips { display: flex; flex-wrap: wrap; gap: var(--s-2); }
  .chip { min-height: 44px; padding: 0 var(--s-4); border-radius: var(--r-pill); border: 1.5px solid var(--line-strong); background: var(--surface); font-weight: 600; }
  .chip.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 22%, var(--surface)); }
  .dest, .name { display: flex; flex-direction: column; gap: var(--s-1); font-weight: 600; color: var(--text-dim); }
  .error { display: flex; flex-direction: column; gap: var(--s-2); align-items: flex-start; padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: color-mix(in srgb, var(--c-bad) 16%, var(--surface)); }
  .waiting { display: flex; align-items: center; gap: var(--s-2); color: var(--text-dim); }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.3; transform: scale(0.7); } }
  .it { font-weight: 700; }
  .lead { color: var(--text-faint); font-weight: 600; }
</style>
