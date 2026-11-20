<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Triage from '../../components/Triage.svelte';
  import PasteList from '../../components/PasteList.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import WizardEffort from '../../components/WizardEffort.svelte';
  import { customDecks, dedupe, slugify, wordDecks } from '../../lib/content';
  import { hasKey, NOT_HERE } from '../../lib/claude';
  import { back } from '../../lib/router.svelte';
  import { sfx } from '../../lib/sound';
  import { prefs, savePrefs } from './state.svelte';
  import { generateWords, THEME_CHIPS } from './generate';
  import { parsePastedWords, titleCase } from './words';

  // "Make a deck": paste a list, or give Claude a theme and watch words stream in → drop the
  // duds → save as a new deck or add to one of mine. "More" asks Claude for more, never
  // repeating what is there.
  let { into = null, demo = null }: { into?: string | null; demo?: string | null } = $props();

  const start = untrack(() => ({ into, demo: demo === 'triage', isDemo: demo != null }));
  // Decks words can be added to: my own, plus the built-in deck this was opened from (that saves an edit of it).
  const mine = [...customDecks.all(), ...wordDecks().filter((d) => d.id === start.into && customDecks.isBuiltin(d.id))];
  let target = $state(mine.some((d) => d.id === start.into) ? start.into! : 'new');
  let theme = $state('');
  let count = $state(40);
  let phase = $state<'form' | 'triage'>(start.demo ? 'triage' : 'form');
  let items = $state<string[]>(start.demo ? ['Moon Landing', 'Taylor Swift', 'Pizza Rat', 'Spider-Man', 'Eiffel Tower', 'Karaoke Night', 'Hot Dog Eating Contest', 'Netflix and Chill', 'Zebra Crossing'] : []);
  let streaming = $state(start.demo);
  let error = $state('');
  let controller: AbortController | null = null;

  const targetDeck = $derived(mine.find((d) => d.id === target));
  const keyReady = hasKey();
  const MODES = [{ value: 'paste' as const, label: 'Paste a list' }, { value: 'claude' as const, label: '🧙 Ask the wizard' }];
  let mode = $state<'paste' | 'claude'>(keyReady || start.isDemo ? 'claude' : 'paste');
  let pasteText = $state('');
  let note = $state('');
  let deckName = $state('');

  function pasted(list: string[], skipped: string) {
    items = list;
    note = skipped;
    error = '';
    phase = 'triage';
  }

  async function run() {
    error = '';
    streaming = true;
    phase = 'triage';
    controller?.abort();
    const ctl = (controller = new AbortController());
    const before = items.length;
    try {
      await generateWords({
        theme, count, signal: ctl.signal,
        avoid: [...(targetDeck?.words ?? []), ...items],
        onItem: (w) => items.push(w),
      });
      if (!ctl.signal.aborted && items.length === before) error = 'Fizzwick came back empty-handed. Try again, or reword the theme.';
    } catch (e) {
      error = (e as Error).message;
    } finally {
      if (controller === ctl) streaming = false;
    }
  }

  function save(kept: string[]) {
    let id = target;
    if (targetDeck) {
      // On top, like words typed in the deck editor: the list reads newest first.
      customDecks.put({ ...targetDeck, words: dedupe([...kept, ...targetDeck.words]) });
    } else {
      const fromPaste = mode === 'paste';
      const name = (fromPaste ? deckName.trim() : titleCase(theme.trim())).slice(0, 40) || (fromPaste ? 'My pack' : 'Wizard pack');
      id = 'my-' + slugify(name) + '-' + Date.now().toString(36);
      customDecks.put({ id, name, emoji: fromPaste ? '📝' : '✨', blurb: fromPaste ? 'Pasted list' : 'Conjured by Fizzwick', words: dedupe(kept) });
    }
    if (kept.length && !prefs.deckIds.includes(id)) prefs.deckIds = [id, ...prefs.deckIds];
    savePrefs();
    sfx.win();
    back(into ? '/forehead/decks' : '/forehead');
  }

  function cancel() {
    if (streaming) {
      controller?.abort();
      streaming = false;
      return;
    }
    items = [];
    error = '';
    note = '';
    phase = 'form';
  }

  function chip(t: string) {
    theme = t;
    sfx.tick();
  }

  onDestroy(() => controller?.abort());
</script>

{#snippet saveTo()}
  {#if mine.length}
    <label class="field">
      <span class="lbl">Save to</span>
      <select bind:value={target}>
        <option value="new">A new pack</option>
        {#each mine as d (d.id)}<option value={d.id}>Add to {d.emoji} {d.name}</option>{/each}
      </select>
    </label>
  {/if}
{/snippet}

<Screen title="Make a pack" accent="var(--c-forehead)">
  {#if phase === 'form'}
    <Segmented label="How to make it" options={MODES} bind:value={mode} />
    {#if mode === 'paste'}
      <PasteList label="One word or phrase per line" placeholder={'Moon Landing\nTaylor Swift\nPizza Rat, Karaoke Night'}
        parse={(t) => parsePastedWords(t, targetDeck?.words ?? [])} onadd={pasted} bind:text={pasteText}>
        {@render saveTo()}
      </PasteList>
    {:else if !keyReady && demo == null}
      <p class="nokey">{NOT_HERE}</p>
    {:else}
      <form class="stack" onsubmit={(e) => { e.preventDefault(); if (theme.trim()) void run(); }}>
        <label class="field">
          <span class="lbl">Theme</span>
          <!-- svelte-ignore a11y_autofocus -->
          <input type="text" placeholder="e.g. Disney villains, our office" bind:value={theme} maxlength="80" enterkeyhint="go" autofocus />
        </label>
        <div class="chips" aria-label="Theme ideas">
          {#each THEME_CHIPS as t (t)}
            <button type="button" class="chip" class:on={theme === t} onclick={() => chip(t)}>{t}</button>
          {/each}
        </div>
        <Stepper label="How many words" bind:value={count} min={20} max={80} step={10} />
        {@render saveTo()}
        <WizardEffort />
        <Button type="submit" size="lg" disabled={!theme.trim()}>✨ Make {count} words</Button>
      </form>
    {/if}
  {:else}
    <div class="head">
      {#if mode === 'paste'}
        {#if targetDeck}
          <h3>Your list</h3>
          <p class="faint">Adding to {targetDeck.name}</p>
        {:else}
          <label class="field">
            <span class="lbl">Pack name</span>
            <input type="text" placeholder="My pack" bind:value={deckName} maxlength="40" autocomplete="off" />
          </label>
        {/if}
      {:else}
        <h3>{theme ? `“${titleCase(theme)}”` : 'New words'}</h3>
        <p class="faint">{targetDeck ? `Adding to ${targetDeck.name}` : 'Saving as a new pack'}</p>
      {/if}
    </div>
    {#if note}<p class="faint note">{note}</p>{/if}
    {#if error}
      <div class="error" role="alert">
        <p>{error}</p>
        <Button size="sm" variant="secondary" onclick={run}>Try again</Button>
      </div>
    {/if}
    <Triage {items} keyOf={(s: string) => s} {streaming} onsave={save} oncancel={cancel} onmore={mode === 'claude' && theme ? run : undefined}>
      {#snippet item(s: string)}<span class="word">{s}</span>{/snippet}
    </Triage>
  {/if}
</Screen>

<style>
  .field { display: flex; flex-direction: column; gap: var(--s-1); }
  .lbl { font-weight: 600; color: var(--text-dim); font-size: 0.92rem; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    min-height: 44px; padding: 0 var(--s-4); border-radius: var(--r-pill); border: 1.5px solid var(--line-strong);
    background: transparent; color: var(--text-dim); font-weight: 600; font-size: 0.95rem;
    transition: background var(--dur) ease, color var(--dur) ease, border-color var(--dur) ease;
  }
  .chip.on { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
  .head { display: flex; flex-direction: column; gap: 2px; }
  .head h3 { font-size: 1.5rem; }
  .word { font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; }
  .error {
    display: flex; align-items: center; gap: var(--s-3); justify-content: space-between; padding: var(--s-3) var(--s-4);
    border-radius: var(--r-md); background: color-mix(in srgb, var(--c-bad) 16%, var(--surface)); color: var(--on-danger);
  }
  .note { font-size: 0.92rem; }
  .nokey { color: var(--text-dim); }
</style>
