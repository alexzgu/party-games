<script lang="ts">
  import { onDestroy } from 'svelte';
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import WizardEffort from '../../components/WizardEffort.svelte';
  import PasteList from '../../components/PasteList.svelte';
  import BoardPreview from './BoardPreview.svelte';
  import type { QuizBoard } from '../../lib/content';
  import { hasKey, viaPass, WANTS } from '../../lib/claude';
  import { afterRun } from '../../lib/library';
  import MagicWords from '../../components/MagicWords.svelte';
  import { sfx } from '../../lib/sound';
  import { blankBoard, DEFAULT_CATEGORIES, DEFAULT_LEVELS, emptyTiles, MAX_CATEGORIES, MAX_LEVELS } from './board';
  import { parsePastedBoard } from './parse';
  import { emptyBoardFor, generateBoard } from './generate';
  import { loadNewBoard, saveNewBoard } from './store';

  // "Make a board": start blank at a chosen size, paste one, or ask Claude for a topic and watch
  // the board fill in, easiest row first. Every route ends in the editor, where the host fixes
  // anything before saving. The board in the making is kept in storage, so a reload keeps it.
  // No <form> around the size steppers: their buttons would submit it.
  let { onmade, onresume, onback }: {
    /** A new board is ready for the editor; `note` says what a paste skipped. */
    onmade: (b: QuizBoard, note: string) => void;
    /** Open the unsaved board left from before. */
    onresume: () => void;
    onback: () => void;
  } = $props();

  const keyed = $derived(hasKey());
  const leftover = loadNewBoard();

  const MODES = [
    { value: 'blank' as const, label: 'Blank', tip: 'Start with empty tiles and type every clue' },
    { value: 'paste' as const, label: 'Paste', tip: 'Paste clues and answers as text' },
    { value: 'claude' as const, label: '🧙 Wizard', tip: 'Fizzwick writes the clues on a topic you pick' },
  ];
  // svelte-ignore state_referenced_locally
  let mode = $state<'blank' | 'paste' | 'claude'>(keyed ? 'claude' : 'blank');
  let name = $state('');
  let topic = $state('');
  let cats = $state(DEFAULT_CATEGORIES);
  let len = $state(DEFAULT_LEVELS);
  let pasteText = $state('');

  let live = $state.raw<QuizBoard | null>(null);
  let streaming = $state(false);
  let error = $state('');
  let ctrl: AbortController | null = null;
  const filled = $derived(live ? cats * len - emptyTiles(live).length : 0);

  const TOPICS = ['Movies', '2000s throwback', 'Food & drink', 'Science', 'Sports', 'Geography', 'Music', 'The internet'];

  /** Whether the board on screen is being written through a magic-words pass (taken as Fizzwick starts). */
  let byPass = false;
  /** The draft as kept: marked shared only when Fizzwick wrote it through a pass. */
  const draft = (b: QuizBoard, wizard: boolean): QuizBoard => afterRun(b, wizard && byPass, true);

  /** Opens `b` in the editor; `wizard` for a board Fizzwick wrote. */
  function make(b: QuizBoard, note = '', wizard = false) {
    saveNewBoard(draft(b, wizard));
    onmade(b, note);
  }

  async function ask() {
    if (!topic.trim() || streaming) return;
    error = '';
    streaming = true;
    byPass = viaPass();
    live = emptyBoardFor(topic, cats, len);
    ctrl = new AbortController();
    const signal = ctrl.signal;
    try {
      const done = await generateBoard({
        topic, cats, levels: len, signal,
        onBoard: (b) => { live = b; saveNewBoard(draft(b, true)); sfx.tick(); },
      });
      live = done;
      if (signal.aborted) return;
      if (emptyTiles(done).length === cats * len) error = 'No usable clues came back. Try again or try another topic.';
      else { sfx.correct(); make(done, '', true); }
    } catch (e) {
      error = (e as Error).message;
    } finally {
      streaming = false;
      ctrl = null;
    }
  }

  /** Stops Claude and opens what came so far (or drops it when nothing did). */
  function stop() {
    ctrl?.abort();
    if (live && emptyTiles(live).length < cats * len) make(live, 'Stopped early: fill in the empty tiles or remove what you do not need.', true);
    else live = null;
  }

  function parse(text: string) {
    const { board, skipped } = parsePastedBoard(text, name);
    return { items: board ? [board] : [], skipped };
  }

  onDestroy(() => ctrl?.abort());
</script>

<Screen title="Make a pack" onback={() => { ctrl?.abort(); onback(); }}>
  {#if leftover && !live}
    <div class="leftover" role="status">
      <p>You were making “{leftover.name}”.</p>
      <Button variant="secondary" size="sm" onclick={onresume} tip="Opens the unsaved pack you were making">Continue</Button>
    </div>
  {/if}

  {#if live}
    <section class="live">
      <h3>{live.name}</h3>
      <p class="count" aria-live="polite">
        {#if streaming}<span class="dot" aria-hidden="true"></span> Fizzwick is conjuring… {/if}<b>{filled}</b> of {cats * len} clues
      </p>
      <BoardPreview board={live} />
      {#if error}
        <div class="error" role="alert">
          <p>{error}</p>
          <!-- A refused pass leaves the phone without the wizard: the words come back here, then Try again. -->
          {#if !keyed}<MagicWords intro={WANTS} />{/if}
          <div class="row">
            {#if keyed}<Button variant="secondary" size="sm" onclick={ask}>Try again</Button>{/if}
            {#if filled}<Button variant="ghost" size="sm" onclick={() => live && make(live, '', true)} tip="Opens the clues Fizzwick wrote so far in the editor">Open</Button>{/if}
          </div>
        </div>
      {/if}
    </section>
  {:else}
    <Segmented label="How to make it" options={MODES} bind:value={mode} />

    {#if mode === 'blank'}
      <div class="form">
        <label class="field"><span>Pack name</span>
          <input type="text" bind:value={name} placeholder="My pack" maxlength="40" autocomplete="off" enterkeyhint="done" />
        </label>
        {@render size()}
        <p class="faint small">Then type every clue and answer in the editor.</p>
        <Button size="lg" onclick={() => { make(blankBoard(name, cats, len)); sfx.tap(); }} tip="Opens an empty pack to type the clues into">Blank pack</Button>
      </div>
    {:else if mode === 'paste'}
      <label class="field"><span>Pack name</span>
        <input type="text" bind:value={name} placeholder="Pasted pack" maxlength="40" autocomplete="off" enterkeyhint="done" />
      </label>
      <PasteList submit="Review clues" label="A “# Category” line, then one “clue | answer” line per level, easiest first"
        placeholder={'# Space\nThe planet nicknamed the Red Planet | Mars\nThe first person to walk on the Moon | Neil Armstrong\n# Food\nThe country pizza comes from | Italy'}
        {parse} onadd={(items, note) => make(items[0], note)} bind:text={pasteText} />
      <p class="faint small">Up to {MAX_CATEGORIES} categories of up to {MAX_LEVELS} clues. Shorter categories get empty tiles to fill in.</p>
    {:else if !keyed}
      <div class="nokey">
        <MagicWords intro={WANTS} />
        <p class="faint">Or ask the host for a built-in one: “a Big Board about {topic.trim() || '<topic>'}”. It shows up in the pack list once the site updates.</p>
      </div>
    {:else}
      <div class="form">
        <label class="field" for="topic-in"><span>What should the pack be about?</span></label>
        <input id="topic-in" type="text" bind:value={topic} onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void ask(); } }} placeholder="e.g. 90s cartoons, Taylor Swift, our office" autocomplete="off" enterkeyhint="go" maxlength="80" />
        <div class="chips" role="group" aria-label="Quick topics">
          {#each TOPICS as t (t)}
            <button type="button" class="chip" class:on={topic === t} onclick={() => (topic = t)}>{t}</button>
          {/each}
        </div>
        {@render size()}
        <WizardEffort />
        <p class="faint small">Fizzwick writes {cats * len} clues, easiest row first. You fix anything in the editor before saving.</p>
        <Button size="lg" onclick={ask} disabled={!topic.trim()} tip="Fizzwick writes it; you can change anything before saving">✨ Make pack</Button>
      </div>
    {/if}
  {/if}

  {#snippet actions()}
    {#if live && streaming}<Button variant="secondary" onclick={stop} tip={filled ? 'Opens the clues so far in the editor' : 'Stops Fizzwick; nothing has come yet'}>Stop{filled ? ' & open' : ''}</Button>{/if}
  {/snippet}
</Screen>

{#snippet size()}
  <div class="steppers">
    <Stepper bind:value={cats} min={1} max={MAX_CATEGORIES} label="Categories" />
    <Stepper bind:value={len} min={1} max={MAX_LEVELS} label="Levels" />
    <p class="faint small">{cats * len} tiles; points run 100{len > 1 ? ` to ${len * 100}` : ''} down each category.</p>
  </div>
{/snippet}

<style>
  h3 { font-size: 1.3rem; }
  .small { font-size: 0.9rem; margin: 0; }
  .form { display: flex; flex-direction: column; gap: var(--s-3); }
  .field { display: flex; flex-direction: column; gap: var(--s-1); font-weight: 600; color: var(--text-dim); }
  .field input { color: var(--text); }
  .steppers { display: flex; flex-direction: column; gap: var(--s-2); }
  .chips { display: flex; flex-wrap: wrap; gap: var(--s-2); }
  .chip { min-height: 44px; padding: 0 var(--s-4); border-radius: var(--r-pill); border: 1.5px solid var(--line-strong); background: var(--surface); font-weight: 600; }
  .chip.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 22%, var(--surface)); }
  .nokey { display: flex; flex-direction: column; gap: var(--s-2); color: var(--text-dim); }
  .nokey p { margin: 0; }
  .leftover {
    display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--s-2); padding: var(--s-3) var(--s-4);
    border-radius: var(--r-md); background: color-mix(in srgb, var(--accent) 14%, var(--surface)); border: 1.5px solid color-mix(in srgb, var(--accent) 45%, transparent);
  }
  .leftover p { margin: 0; }
  .live { display: flex; flex-direction: column; gap: var(--s-3); }
  .count { margin: 0; color: var(--text-dim); display: flex; align-items: center; gap: var(--s-2); }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); animation: pulse 1s ease-in-out infinite; }
  @keyframes pulse { 50% { opacity: 0.3; transform: scale(0.7); } }
  .error { display: flex; flex-direction: column; gap: var(--s-2); align-items: flex-start; padding: var(--s-3) var(--s-4); border-radius: var(--r-md); background: color-mix(in srgb, var(--c-bad) 16%, var(--surface)); }
  .error p { margin: 0; }
  .error :global(.magic) { align-self: stretch; }
  .row { display: flex; gap: var(--s-2); flex-wrap: wrap; }
</style>
