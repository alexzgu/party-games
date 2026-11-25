<script lang="ts">
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import SharedPill from '../../components/SharedPill.svelte';
  import PackActions from '../../components/PackActions.svelte';
  import Popup from '../../components/Popup.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import AddMore from '../../components/AddMore.svelte';
  import PinnedPanel from '../../components/PinnedPanel.svelte';
  import { addClues, moreClues, moreShapes, type MoreShape } from './more';
  import type { StreamClue } from './parse';
  import { customQuiz, quizBoards, type QuizBoard } from '../../lib/content';
  import { sfx } from '../../lib/sound';
  import * as edit from './board';
  import { loadNewAsk, loadNewBoard, newBoardId, pickBoard, saveNewAsk, saveNewBoard } from './store';
  import { afterRun, shareWizardPack } from '../../lib/library';
  import WizardNote from '../../components/WizardNote.svelte';
  import WizardChanges from '../../components/WizardChanges.svelte';
  import BoardPreview from './BoardPreview.svelte';
  import { PackName } from '../../lib/packName.svelte';
  import { boardChanges } from './changes';

  // One board, every tile editable in place: name, blurb, categories (add, remove, rename,
  // reorder), levels (added or removed on every category at once) and each clue and answer.
  // A saved board saves on every change; editing a built-in saves this phone's copy under the
  // same id ("Restore original" drops it). A board just made (`id` null) waits in storage
  // until "Save board". Empty tiles are allowed: the board is then a draft that cannot be played.
  let { id, note = '', category = 0, onback, onsaved }: {
    /** The saved board to edit, or null for the board just made. */
    id: string | null;
    /** What the paste step skipped, shown once at the top. */
    note?: string;
    /** The category tab to open on (e.g. the one with an empty tile). */
    category?: number;
    onback: () => void;
    onsaved: (id: string) => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  const fresh = id === null;
  // svelte-ignore state_referenced_locally
  const builtin = id !== null && customQuiz.isBuiltin(id);
  // svelte-ignore state_referenced_locally
  let board = $state.raw<QuizBoard | null>(fresh ? loadNewBoard() : (quizBoards().find((b) => b.id === id) ?? null));
  // svelte-ignore state_referenced_locally
  let edited = $state(id !== null && customQuiz.isEdited(id));
  // svelte-ignore state_referenced_locally
  let ci = $state(Math.max(0, Math.min(category, (board?.categories.length ?? 1) - 1)));
  let confirm = $state<'' | 'restore' | 'delete' | 'leave' | 'level' | 'category'>('');

  const cats = $derived(board?.categories ?? []);
  const len = $derived(board ? edit.levels(board) : 0);
  const cat = $derived(cats[Math.min(ci, cats.length - 1)]);
  const gaps = $derived(board ? edit.emptyTiles(board) : []);
  const gapsIn = (c: number) => gaps.filter((g) => g.category === c).length;
  const value = (r: number) => (r + 1) * 100;

  /** A change by hand (none while Fizzwick rewrites the board). */
  function update(next: QuizBoard) {
    if (!board || next === board || changes?.busy) return;
    board = next;
    if (fresh) saveNewBoard(next);
    else {
      const { custom: _, ...plain } = next;
      customQuiz.put(plain);
      edited = customQuiz.isEdited(next.id);
    }
  }

  const field = (key: 'name' | 'blurb') => (e: Event & { currentTarget: HTMLInputElement }) => board && update({ ...board, [key]: e.currentTarget.value });
  function typeName(e: Event & { currentTarget: HTMLInputElement }) {
    if (asked) typedName(e.currentTarget.value);
    else field('name')(e);
  }

  // Levels change at the bottom (hardest) row, on every category. Removing a row with
  // anything written in it asks first.
  function setLevels(n: number) {
    if (!board) return;
    if (n > len) update(edit.addLevel(board));
    else if (n < len) {
      if (edit.levelContent(board, len - 1)) confirm = 'level';
      else update(edit.removeLevel(board, len - 1));
    }
  }

  /** The open category's head: another category starts from its top. */
  let head = $state<HTMLDivElement>();
  function open(i: number) {
    ci = i;
    head?.scrollIntoView({ block: 'nearest' });
  }

  function addCategory() {
    if (!board) return;
    update(edit.addCategory(board));
    open(board.categories.length - 1);
    sfx.tap();
  }

  function removeCategory() {
    if (!board) return;
    update(edit.removeCategory(board, ci));
    ci = Math.max(0, Math.min(ci, board.categories.length - 1));
    confirm = '';
  }

  function move(dir: -1 | 1) {
    if (!board) return;
    const before = board;
    update(edit.moveCategory(board, ci, dir));
    if (board !== before) ci += dir;
  }

  /** "🧙 Add more" is open in place of the editor: a new category or a harder level. */
  let adding = $state(false);
  const shapes = $derived(board && !fresh && !builtin ? moreShapes(board) : []);
  let shape = $state<MoreShape>('category');
  const SHAPE_LABELS: Record<MoreShape, string> = { category: 'A new category', level: 'A harder level' };
  function openMore() {
    if (!shapes.includes(shape)) shape = shapes[0];
    adding = true;
  }
  function addMore(kept: StreamClue[], byPass: boolean) {
    if (!board) return;
    const at = board.categories.length;
    update(afterRun(addClues(board, shape, kept), byPass, false));
    void shareWizardPack('quiz', board, byPass);
    if (shape === 'category') ci = Math.min(at, board.categories.length - 1);
    adding = false;
    sfx.correct();
  }

  // "Ask for changes" on the board Fizzwick just wrote, until it is saved: he writes the whole
  // board again at its size as it stands, keeping what fits. Whether the unsaved board is his comes
  // from what is stored with it (the request), so a reload or "Continue" keeps the box and the note.
  // While he writes, the board is shown, read-only, from memory: storage keeps the whole board from
  // before until the change has finished, so a reload mid-change finds it untouched.
  // svelte-ignore state_referenced_locally
  const asked = fresh ? loadNewAsk() : null;
  /** The board's name follows the same rule as every pack name (lib/packName.svelte.ts). */
  const boardName = new PackName();
  // svelte-ignore state_referenced_locally
  if (asked && board) {
    boardName.begin('wizard', asked.request, 'My pack');
    if (asked.typed) boardName.type(board.name);
    else boardName.value = board.name;
  }
  function typedName(value: string) {
    if (!board || changes?.busy) return;
    boardName.type(value);
    saveNewAsk({ request: asked!.request, typed: true });
    update({ ...board, name: boardName.value });
  }
  // svelte-ignore state_referenced_locally
  const changes = asked && boardChanges({
    request: asked.request, board: () => board, show: (b) => (board = b), store: saveNewBoard,
    tab: () => ci, setTab: (i) => (ci = i), name: boardName, onItem: () => sfx.tick(),
  });

  function restore() {
    if (id === null) return;
    customQuiz.restore(id);
    board = customQuiz.original(id) ?? null;
    edited = false;
    ci = 0;
    confirm = '';
  }

  function deleteBoard() {
    if (id === null) return;
    customQuiz.remove(id);
    confirm = '';
    onback();
  }

  function saveNew() {
    if (!board) return;
    const clean = edit.tidyBoard(board);
    const saved = { ...clean, id: newBoardId(clean.name) };
    customQuiz.put(saved); // with the draft's share mark, for a later Add more
    void shareWizardPack('quiz', saved, true); // the draft is marked only when its run was through a pass
    saveNewBoard(null);
    pickBoard(saved.id);
    sfx.correct();
    onsaved(saved.id);
  }

  function discard() {
    saveNewBoard(null);
    confirm = '';
    onback();
  }

  /** A blank name gets a sensible one when the field is left. */
  function settleName(key: 'name' | 'category') {
    if (!board) return;
    if (key === 'name' && !board.name.trim()) {
      if (asked) typedName('My pack');
      else update({ ...board, name: 'My pack' });
    }
    if (key === 'category' && cat && !cat.name.trim()) update(edit.renameCategory(board, ci, `Category ${ci + 1}`));
  }
</script>

{#if adding && board}
  {@const b = board}
  <AddMore name={b.name} noun="clues" steerHint="e.g. more about the 90s, harder"
    cta={shape === 'category' ? '✨ Conjure a new category' : '✨ Conjure a harder level'}
    ask={(o) => moreClues(b, shape, o)} keyOf={(k: StreamClue) => `${k.level}|${k.category}`} onadd={addMore} onclose={() => (adding = false)}>
    {#snippet size()}
      <Segmented label="What to add" options={shapes.map((v) => ({ value: v, label: SHAPE_LABELS[v] }))} bind:value={shape} />
      <p class="faint small">{shape === 'category' ? `${edit.levels(b)} clues, easiest first` : `One clue for each of the ${b.categories.length} categories, at ${(edit.levels(b) + 1) * 100}`}</p>
    {/snippet}
    {#snippet item(k: StreamClue)}
      <span class="more"><span class="where">{k.category} · {k.level * 100}</span><span>{k.clue}</span><b>→ {k.answer}</b></span>
    {/snippet}
  </AddMore>
{:else}
<Screen title={fresh ? 'New pack' : 'Edit pack'} onback={() => { changes?.stop(); if (fresh && board) confirm = 'leave'; else onback(); }} fill={!!board}>
  {#if !board}
    <p class="muted">{fresh ? 'There is no pack being made on this phone.' : 'This pack is no longer on this phone.'}</p>
  {:else}
    <!-- Pinned: the pack's details (they fold away) and the category tabs; only the open
         category's name, tools and clues scroll. -->
    <PinnedPanel kind="editor" foldId="quiz-details" foldName="details" foldSpoken="pack details" keep="items">
      {#snippet notice()}{#if note}<p class="faint small">{note}</p>{/if}{#if asked}<WizardNote />{/if}{/snippet}
      {#snippet top()}
        {#if board}
          <!-- Read-only while Fizzwick rewrites the board: nothing typed then can be lost. -->
          <div class="lock" inert={!!changes?.busy}>
          <div class="about">
            <p class="muted">
              {#if fresh}Not saved yet{:else if builtin}Comes with the app{edited ? ' · edited on this phone' : ''}{:else if board?.shared}<SharedPill />{:else}Your pack, on this phone only{/if}
            </p>
            {#if builtin && edited}
              <span class="act"><Button variant="secondary" size="sm" onclick={() => (confirm = 'restore')} tip="Undoes your changes and brings back the original pack">Restore original</Button></span>
            {:else if !fresh && !builtin}
              <span class="act"><Button variant="ghost" size="sm" onclick={() => (confirm = 'delete')}>Delete pack</Button></span>
            {/if}
          </div>
          {#if !fresh}<PackActions game="quiz" pack={board} onshared={() => (board = board && { ...board, shared: true })} />{/if}

          <label class="field">
            <span>Pack name</span>
            <input type="text" value={board.name} oninput={typeName} onchange={() => settleName('name')} maxlength="40" autocomplete="off" enterkeyhint="done" />
          </label>
          <label class="field">
            <span>Short description</span>
            <input type="text" value={board.blurb} oninput={field('blurb')} maxlength="80" autocomplete="off" enterkeyhint="done" placeholder="What it's about" />
          </label>

          <section class="size" aria-label="Board size">
            <Stepper bind:value={() => len, setLevels} min={1} max={edit.MAX_LEVELS} label="Levels" />
            <p class="status" class:warn={gaps.length > 0} role="status">
              {cats.length} {cats.length === 1 ? 'category' : 'categories'} × {len} {len === 1 ? 'level' : 'levels'} ({len === 1 ? '100' : `100–${len * 100}`} points)
              {#if gaps.length} · {gaps.length} empty {gaps.length === 1 ? 'tile' : 'tiles'}: saved as a draft, playable once filled{:else} · ready to play{/if}
            </p>
          </section>
          </div>
        {/if}
      {/snippet}
      {#snippet row(toggle)}
        <div class="tabrow">
          <div class="tabs" role="tablist" aria-label="Categories" inert={!!changes?.busy}>
            {#each cats as c, i (i)}
              <button class="tab" class:on={i === ci} role="tab" aria-selected={i === ci} onclick={() => open(i)}>
                <span class="tname">{c.name.trim() || `Category ${i + 1}`}</span>
                {#if gapsIn(i)}<span class="badge" aria-label="{gapsIn(i)} empty">{gapsIn(i)}</span>{/if}
              </button>
            {/each}
            <button class="tab add" onclick={addCategory} disabled={cats.length >= edit.MAX_CATEGORIES} aria-label="Add a category" data-tip="Adds an empty category to this pack">+ Category</button>
          </div>
          {@render toggle()}
        </div>
      {/snippet}

      {#if changes?.busy}
        <BoardPreview {board} />
      {:else if cat}
        <div class="cat" role="tabpanel" aria-label={cat.name}>
          <div class="cathead" bind:this={head}>
            <label class="field grow">
              <span>Category {ci + 1} of {cats.length}</span>
              <input type="text" value={cat.name} oninput={(e) => board && update(edit.renameCategory(board, ci, e.currentTarget.value))} onchange={() => settleName('category')} maxlength="40" autocomplete="off" enterkeyhint="done" />
            </label>
            <div class="tools">
              <button class="tool" onclick={() => move(-1)} disabled={ci === 0} aria-label="Move category left">←</button>
              <button class="tool" onclick={() => move(1)} disabled={ci >= cats.length - 1} aria-label="Move category right">→</button>
              <button class="tool" onclick={() => (confirm = 'category')} disabled={cats.length <= 1} aria-label="Remove this category">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            </div>
          </div>

          <ol class="clues">
            {#each cat.clues as k, r (r)}
              <li class="clue">
                <span class="val">{value(r)}</span>
                <div class="inputs">
                  <textarea rows="2" value={k.clue} class:missing={!k.clue.trim()} placeholder="Clue the host reads out"
                    aria-label="{cat.name} {value(r)} clue"
                    oninput={(e) => board && update(edit.setClue(board, ci, r, { clue: e.currentTarget.value }))}></textarea>
                  <input type="text" value={k.answer} class:missing={!k.answer.trim()} placeholder="Answer" maxlength="80"
                    aria-label="{cat.name} {value(r)} answer" autocomplete="off" enterkeyhint="next"
                    oninput={(e) => board && update(edit.setClue(board, ci, r, { answer: e.currentTarget.value }))} />
                </div>
              </li>
            {/each}
          </ol>
          <p class="faint small">Easiest at the top, hardest at the bottom.</p>
        </div>
      {/if}
      {#if changes}<WizardChanges {changes} />{/if}
    </PinnedPanel>
  {/if}

  {#snippet actions()}
    {#if changes?.busy}
      <Button size="lg" variant="secondary" onclick={() => changes.stop()} tip="Stops Fizzwick and brings back the board as it was">Stop</Button>
    {:else if board && fresh}
      <Button size="lg" onclick={saveNew} tip={gaps.length ? 'Keeps it with its gaps; playable once every tile is filled' : 'Saves it and picks it for your next game'}>{gaps.length ? 'Save draft' : 'Save pack'}</Button>
    {:else}
      {#if shapes.length}<Button size="lg" variant="secondary" onclick={openMore} tip="Fizzwick writes a new category or harder clues; you choose">🧙 Add more</Button>{/if}
      <Button size="lg" onclick={onback}>Done</Button>
    {/if}
  {/snippet}
</Screen>
{/if}

{#if board && confirm === 'restore'}
  <Popup title="Restore original?" onclose={() => (confirm = '')}>
    <div class="confirm">
      <p>“{customQuiz.original(id ?? '')?.name}” goes back to the clues that came with the app. Your changes to it are lost.</p>
      <Button variant="danger" onclick={restore}>Restore original</Button>
      <Button variant="secondary" onclick={() => (confirm = '')}>Keep changes</Button>
    </div>
  </Popup>
{:else if board && confirm === 'delete'}
  <Popup title="Delete this pack?" onclose={() => (confirm = '')}>
    <div class="confirm">
      <p>“{board.name}” is deleted from this phone.</p>
      <Button variant="danger" onclick={deleteBoard}>Delete pack</Button>
      <Button variant="secondary" onclick={() => (confirm = '')}>Keep it</Button>
    </div>
  </Popup>
{:else if board && confirm === 'leave'}
  <Popup title="Save this pack?" onclose={() => (confirm = '')}>
    <div class="confirm">
      <p>“{board.name}” is not saved yet.</p>
      <Button onclick={saveNew} tip={gaps.length ? 'Keeps it with its gaps; playable once every tile is filled' : 'Saves it and picks it for your next game'}>{gaps.length ? 'Save draft' : 'Save pack'}</Button>
      <Button variant="danger" onclick={discard} tip="Deletes this unsaved pack for good">Discard</Button>
      <Button variant="ghost" onclick={() => (confirm = '')}>Keep editing</Button>
    </div>
  </Popup>
{:else if board && confirm === 'level'}
  <Popup title="Remove the bottom level?" onclose={() => (confirm = '')}>
    <div class="confirm">
      <p>The {value(len - 1)} row has clues in {edit.levelContent(board, len - 1)} of {cats.length} {cats.length === 1 ? 'category' : 'categories'}. They are deleted.</p>
      <Button variant="danger" onclick={() => { if (board) update(edit.removeLevel(board, len - 1)); confirm = ''; }}>Remove level</Button>
      <Button variant="secondary" onclick={() => (confirm = '')}>Keep it</Button>
    </div>
  </Popup>
{:else if board && cat && confirm === 'category'}
  <Popup title="Remove “{cat.name}”?" onclose={() => (confirm = '')}>
    <div class="confirm">
      <p>This category and its {len} {len === 1 ? 'clue' : 'clues'} are deleted.</p>
      <Button variant="danger" onclick={removeCategory}>Remove category</Button>
      <Button variant="secondary" onclick={() => (confirm = '')}>Keep it</Button>
    </div>
  </Popup>
{/if}

<style>
  .lock { display: contents; }
  .about { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); min-height: 44px; }
  .about p { margin: 0; }
  .act { flex: none; white-space: nowrap; }
  .small { font-size: 0.85rem; margin: 0; }
  .field { display: flex; flex-direction: column; gap: var(--s-1); font-weight: 600; color: var(--text-dim); min-width: 0; }
  .field input { color: var(--text); }
  .grow { flex: 1; }
  .size { display: flex; flex-direction: column; gap: var(--s-2); }
  .status { margin: 0; color: var(--text-dim); font-size: 0.9rem; }
  .status.warn { color: var(--c-pass); }
  /* The tabs scroll sideways from the screen's left edge up to the details toggle. */
  .tabrow { display: flex; align-items: center; gap: var(--s-1); padding-bottom: var(--s-3); }
  .tabs {
    flex: 1; min-width: 0; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none;
    margin-left: calc(-1 * var(--gutter-l, var(--s-4))); padding: 2px var(--s-1) 2px var(--gutter-l, var(--s-4));
  }
  .tabs::-webkit-scrollbar { display: none; }
  .tab {
    flex: none; max-width: 180px; min-height: 44px; padding: 0 var(--s-3); border-radius: var(--r-pill);
    display: flex; align-items: center; gap: 6px; border: 1.5px solid var(--line-strong); background: var(--surface); font-weight: 700;
  }
  .tab.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 20%, var(--surface)); }
  .tab .tname { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .badge { flex: none; min-width: 20px; height: 20px; padding: 0 5px; border-radius: var(--r-pill); background: var(--c-pass); color: var(--bg); font-size: 0.72rem; font-weight: 800; display: grid; place-items: center; }
  .tab.add { border-style: dashed; color: var(--text-dim); }
  .tab:disabled { opacity: 0.4; }
  .cat { display: flex; flex-direction: column; gap: var(--s-3); }
  .cathead { display: flex; align-items: flex-end; gap: var(--s-2); }
  .tools { display: flex; gap: 4px; }
  .tool {
    width: 44px; height: 48px; border-radius: var(--r-sm); border: 1.5px solid var(--line-strong); background: var(--surface);
    display: grid; place-items: center; font-weight: 800; font-size: 1.1rem; color: var(--text-dim);
  }
  .tool:disabled { opacity: 0.35; }
  .clues { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-3); }
  .clue { display: flex; gap: var(--s-2); align-items: flex-start; }
  .val {
    flex: none; width: 52px; padding-top: 10px; text-align: right; font-family: var(--font-display); font-weight: 800;
    color: var(--accent); font-variant-numeric: tabular-nums;
  }
  .inputs { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
  textarea { min-height: 64px; resize: vertical; line-height: 1.35; }
  .inputs input { font-weight: 700; }
  .missing { border-color: color-mix(in srgb, var(--c-pass) 60%, var(--line-strong)); }
  .more { display: flex; flex-direction: column; gap: 2px; }
  .where { color: var(--text-faint); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
  .confirm { display: flex; flex-direction: column; gap: var(--s-2); }
  .confirm p { margin: 0 0 var(--s-2); }
</style>
