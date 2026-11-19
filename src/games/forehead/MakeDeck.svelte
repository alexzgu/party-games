<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Triage from '../../components/Triage.svelte';
  import { customDecks, dedupe, slugify } from '../../lib/content';
  import { hasKey } from '../../lib/claude';
  import { back, go } from '../../lib/router.svelte';
  import { sfx } from '../../lib/sound';
  import { prefs, savePrefs } from './state.svelte';
  import { generateWords, THEME_CHIPS } from './generate';
  import { titleCase } from './words';

  // "Make with Claude": theme → words stream in → drop the duds → save as a new deck or
  // add to one of mine. "More like these" asks for more, never repeating what is there.
  let { into = null, demo = null }: { into?: string | null; demo?: string | null } = $props();

  const mine = customDecks.all();
  const start = untrack(() => ({ into, demo: demo === 'triage' }));
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
      if (!ctl.signal.aborted && items.length === before) error = 'Claude sent nothing usable that time. Try again, or reword the theme.';
    } catch (e) {
      error = (e as Error).message;
    } finally {
      if (controller === ctl) streaming = false;
    }
  }

  function save(kept: string[]) {
    let id = target;
    if (targetDeck) {
      customDecks.put({ ...targetDeck, words: dedupe([...targetDeck.words, ...kept]) });
    } else {
      id = 'my-' + slugify(theme) + '-' + Date.now().toString(36);
      const name = titleCase(theme.trim()).slice(0, 40) || 'Claude deck';
      customDecks.put({ id, name, emoji: '✨', blurb: 'Made with Claude', words: dedupe(kept) });
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
    phase = 'form';
  }

  function chip(t: string) {
    theme = t;
    sfx.tick();
  }

  onDestroy(() => controller?.abort());
</script>

<Screen title="Make with Claude" accent="var(--c-forehead)">
  {#if !keyReady && demo == null}
    <div class="nokey pop-in">
      <span class="big" aria-hidden="true">🔑</span>
      <h3>Claude needs a key first</h3>
      <p class="muted">Paste an Anthropic API key in Settings once on this phone, then come back here. All the built-in decks work without one.</p>
      <Button onclick={() => go('/settings')}>Open Settings</Button>
    </div>
  {:else if phase === 'form'}
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
      {#if mine.length}
        <label class="field">
          <span class="lbl">Save to</span>
          <select bind:value={target}>
            <option value="new">A new deck</option>
            {#each mine as d (d.id)}<option value={d.id}>Add to {d.emoji} {d.name}</option>{/each}
          </select>
        </label>
      {/if}
      <Button type="submit" size="lg" disabled={!theme.trim()}>✨ Make {count} words</Button>
    </form>
  {:else}
    <div class="head">
      <h3>{theme ? `“${titleCase(theme)}”` : 'New words'}</h3>
      <p class="faint">{targetDeck ? `Adding to ${targetDeck.name}` : 'Saving as a new deck'}</p>
    </div>
    {#if error}
      <div class="error" role="alert">
        <p>{error}</p>
        <Button size="sm" variant="secondary" onclick={run}>Try again</Button>
      </div>
    {/if}
    <Triage {items} keyOf={(s: string) => s} {streaming} onsave={save} oncancel={cancel} onmore={theme ? run : undefined}>
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
    border-radius: var(--r-md); background: color-mix(in srgb, var(--c-bad) 16%, var(--surface)); color: #ffd0d8;
  }
  .nokey { text-align: center; display: flex; flex-direction: column; align-items: center; gap: var(--s-3); padding: var(--s-6) var(--s-2); }
  .nokey p { max-width: 34ch; }
  .big { font-size: 3.2rem; }
</style>
