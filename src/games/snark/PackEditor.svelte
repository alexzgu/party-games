<script lang="ts">
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import SharedPill from '../../components/SharedPill.svelte';
  import PackActions from '../../components/PackActions.svelte';
  import Popup from '../../components/Popup.svelte';
  import ListTools from '../../components/ListTools.svelte';
  import PinnedPanel from '../../components/PinnedPanel.svelte';
  import AddMore from '../../components/AddMore.svelte';
  import FinalForm from './FinalForm.svelte';
  import WizardItem from './WizardItem.svelte';
  import { changeFinal, changePrompt, changeSaved, type Change, type PromptText } from './edits';
  import { customSnark, snarkPacks, type SnarkFinal, type SnarkPack } from '../../lib/content';
  import type { SortKey } from '../../lib/listing';
  import { sfx } from '../../lib/sound';
  import { findPrompts } from './find';
  import { afterRun, shareWizardPack } from '../../lib/library';
  import { fillStock, MORE_RANGE, moreItems, toFill } from './generate';
  import { addItems, addStock, itemKey, missingStock, packTexts, type SnarkItem, type Stock } from './pack';

  // One pack, every prompt listed with its stock answer: rename, add, edit, delete; every change
  // saves at once on the pack as it is saved by then (edits.ts), the finals under them likewise; one that could not be
  // saved stays open and says why. Editing a built-in saves this device's copy under the same id; "Restore original" drops it. The player's own packs get "🧙 Add more" and, when some prompts have no
  // stock answer (pasted or older packs), "🧙 Stock answers".
  let { id, onback }: { id: string; onback: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const builtin = customSnark.isBuiltin(id);
  // svelte-ignore state_referenced_locally
  const initial = snarkPacks().find((p) => p.id === id) ?? null;
  let pack = $state<SnarkPack | null>(initial);
  // svelte-ignore state_referenced_locally
  let edited = $state(customSnark.isEdited(id));
  let name = $state(initial?.name ?? '');
  /** Deleted elsewhere; what is open stays open until it is closed. */
  let gone = $state(false);
  /** The prompt open in its popup, as it read (null: a new one). */
  let open = $state.raw<{ was: PromptText | null } | null>(null);
  /** The final open in its popup. */
  let openFinal = $state.raw<{ was: SnarkFinal | null } | null>(null);
  let draft = $state('');
  let stockDraft = $state('');
  let problem = $state('');
  let nameProblem = $state('');
  let confirm = $state<'' | 'restore' | 'delete'>('');
  let query = $state('');
  let sort = $state<SortKey>('suggested');
  const shown = $derived(pack ? findPrompts(pack.prompts, query, sort) : []);

  /** Saves a change and shows the pack as it then stands; why it could not be saved, or ''. */
  function apply(change: Change): string {
    const r = changeSaved(id, change);
    gone = !r.pack;
    if (r.pack) pack = r.pack;
    edited = customSnark.isEdited(id);
    return r.problem;
  }

  function rename() {
    if (!pack) return;
    const n = name.trim().replace(/\s+/g, ' ');
    nameProblem = n && n !== pack.name ? apply((now) => ({ ...now, name: n })) : '';
    if (!nameProblem) name = pack.name;
  }

  function edit(q: string | null) {
    const was = q === null ? null : { text: q, stock: pack?.safety?.[q] ?? '' };
    open = { was };
    draft = was?.text ?? '';
    stockDraft = was?.stock ?? '';
    problem = '';
  }

  function save(e: SubmitEvent) {
    e.preventDefault();
    if (!open) return;
    const text = draft.trim().replace(/\s+/g, ' ');
    problem = text ? apply(changePrompt(open.was, { text, stock: stockDraft.trim().replace(/\s+/g, ' ') })) : 'Type a prompt first.';
    if (problem) return;
    open = null;
    query = '';
    sfx.correct();
  }

  function remove(was: PromptText) {
    problem = apply(changePrompt(was, null));
    if (!problem) open = null;
  }

  function saveFinal(was: SnarkFinal | null, to: SnarkFinal | null): string {
    const why = apply(changeFinal(was, to));
    if (why) return why;
    openFinal = null;
    sfx.correct();
    return '';
  }

  /** "🧙 Add more" or "🧙 Stock answers", open in place of the editor. */
  let adding = $state<'' | 'more' | 'fill'>('');
  const missing = $derived(pack ? missingStock(pack).length : 0);
  const otherTexts = () => snarkPacks().filter((p) => p.id !== id).flatMap(packTexts);
  /** What the wizard added (prompts, or stock answers) is saved, then the whole pack is shared (when made through a pass). */
  function added(add: (now: SnarkPack) => SnarkPack, byPass: boolean): string {
    const why = apply((now) => afterRun(add(now), byPass, false));
    if (why) return why;
    void shareWizardPack('snark', $state.snapshot(pack) as SnarkPack, byPass);
    query = '';
    adding = '';
    sfx.correct();
    return '';
  }

  function restore() {
    customSnark.restore(id);
    pack = customSnark.original(id) ?? null;
    name = pack?.name ?? '';
    edited = false;
    confirm = '';
  }

  function deletePack() {
    customSnark.remove(id);
    confirm = '';
    onback();
  }
</script>

{#if adding && pack}
  {@const p = $state.snapshot(pack) as SnarkPack}
  {#if adding === 'more'}
    <AddMore name={p.name} noun="prompts" range={MORE_RANGE} steerHint="e.g. more about work, sillier"
      ask={(o) => moreItems(p, otherTexts(), o)} keyOf={itemKey} onadd={(kept: SnarkItem[], byPass: boolean) => added((now) => addItems(now, kept), byPass)} onclose={() => (adding = '')}>
      {#snippet item(i: SnarkItem)}<WizardItem {i} />{/snippet}
    </AddMore>
  {:else}
    {@const n = toFill(p).length}
    <AddMore title="🧙 Stock answers" name={p.name} noun="stock answers" range={null} steerHint="e.g. sillier, shorter"
      cta="✨ Write answers" ask={(o) => fillStock(p, o)} keyOf={itemKey}
      onadd={(kept: Stock[], byPass: boolean) => added((now) => addStock(now, kept), byPass)} onclose={() => (adding = '')}>
      {#snippet size()}<p class="muted">{missing} {missing === 1 ? 'prompt has' : 'prompts have'} no stock answer for “Suggest”.{missing > n ? ` Fizzwick does ${n} at a time.` : ''}</p>{/snippet}
      {#snippet item(i: Stock)}<WizardItem {i} />{/snippet}
    </AddMore>
  {/if}
{:else}
<Screen title={pack?.name ?? 'Pack'} {onback} fill={!!pack && !gone}>
  {#if !pack || gone}
    <p class="muted">This pack is no longer on this device.</p>
  {:else}
    <PinnedPanel kind="editor" label="snark-items-h" foldId="snark-details" foldName="details" foldSpoken="pack details" keep="items">
      {#snippet top()}
        {#if pack}
          <div class="about">
            <p class="muted">{#if builtin}Comes with the app{edited ? ' · edited on this device' : ''}{:else if pack?.shared}<SharedPill />{:else}Your pack, on this device only{/if}</p>
            {#if builtin && edited}
              <span class="act"><Button variant="secondary" size="sm" onclick={() => (confirm = 'restore')} tip="Undoes your changes and brings back the original pack">Restore original</Button></span>
            {:else if !builtin}
              <span class="act"><Button variant="ghost" size="sm" onclick={() => (confirm = 'delete')}>Delete pack</Button></span>
            {/if}
          </div>
          <PackActions game="snark" {pack} onshared={() => { if (pack) pack.shared = true; }} />
          {#if !builtin && missing}
            <div class="fill">
              <p class="muted">{missing} {missing === 1 ? 'prompt has' : 'prompts have'} no stock answer, so “Suggest” can't help there.</p>
              <Button variant="secondary" onclick={() => (adding = 'fill')} tip="Fizzwick writes a stock answer for prompts without one">🧙 Stock answers</Button>
            </div>
          {/if}
          <label class="name">
            <span>Pack name</span>
            <input type="text" bind:value={name} onchange={rename} maxlength="40" autocomplete="off" enterkeyhint="done" />
          </label>
          {#if nameProblem}<p class="problem" role="alert">{nameProblem}</p>{/if}
        {/if}
      {/snippet}
      {#snippet row(toggle)}
        <ListTools key="snark:prompts" bind:query bind:sort placeholder="Search prompts" shown={shown.length} total={pack?.prompts.length}>
          {#snippet title()}
            <h3 class="count" id="snark-items-h">{pack?.prompts.length} prompts</h3>
            <p class="tip">Tap one to change it</p>
          {/snippet}
          {#snippet extra()}{@render toggle()}{/snippet}
        </ListTools>
      {/snippet}

      {#if query && !shown.length}<p class="none">No prompts match “{query.trim()}”</p>{/if}
      <ul class="prompts">
        {#each shown as { q, i } (i)}
          {@const stock = pack.safety?.[q]}
          <li><button class="prompt" onclick={() => edit(q)}>{q}{#if stock}<span class="stock">Suggest: {stock}</span>{/if}</button></li>
        {/each}
      </ul>
      <section class="list" aria-label="Finals">
        <h3 class="count">{pack.finals?.length ?? 0} {pack.finals?.length === 1 ? 'final' : 'finals'} for three-line duels</h3>
        <ul class="prompts">
          {#each pack.finals ?? [] as f, i (i)}
            <li><button class="prompt" onclick={() => (openFinal = { was: $state.snapshot(f) as SnarkFinal })}>{f.prompt}<span class="stock">House: {f.house.join(' · ')}</span></button></li>
          {/each}
        </ul>
        <Button variant="secondary" size="sm" onclick={() => (openFinal = { was: null })} tip="Type in a prompt for three-line duels and the house's three lines">+ Final</Button>
      </section>
    </PinnedPanel>
  {/if}
  {#snippet actions()}
    {#if pack && !gone && !builtin}<Button size="lg" variant="secondary" onclick={() => (adding = 'more')} tip="Fizzwick writes more; you choose which to add">🧙 Add more</Button>{/if}
    {#if pack && !gone}<Button size="lg" onclick={() => edit(null)} tip="Type in a new prompt yourself">+ Prompt</Button>{/if}
  {/snippet}
</Screen>
{/if}

{#if open}
  {@const was = open.was}
  <Popup title={was ? 'Edit prompt' : 'New prompt'} onclose={() => (open = null)}>
    <form class="form" onsubmit={save}>
      <label class="field">
        <span>Prompt</span>
        <textarea bind:value={draft} rows="3" maxlength="140" oninput={() => (problem = '')} placeholder="A terrible name for a boat"></textarea>
      </label>
      <label class="field">
        <span>Stock answer for “Suggest” (optional)</span>
        <input type="text" bind:value={stockDraft} maxlength="80" autocomplete="off" placeholder="The Unsinkable II" />
      </label>
      {#if problem}<p class="problem" role="alert">{problem}</p>{/if}
      <Button type="submit">{was ? 'Save prompt' : 'Add prompt'}</Button>
      {#if was}<Button variant="danger" onclick={() => remove(was)}>Delete prompt</Button>{/if}
    </form>
  </Popup>
{/if}

{#if openFinal}
  {@const was = openFinal.was}
  <FinalForm {was} save={(f) => saveFinal(was, f)} onclose={() => (openFinal = null)} />
{/if}

{#if pack && confirm === 'restore'}
  <Popup title="Restore original?" onclose={() => (confirm = '')}>
    <div class="form">
      <p>“{customSnark.original(id)?.name}” goes back to the prompts that came with the app. Your changes to it are lost.</p>
      <Button variant="danger" onclick={restore}>Restore original</Button>
      <Button variant="secondary" onclick={() => (confirm = '')}>Keep changes</Button>
    </div>
  </Popup>
{:else if pack && confirm === 'delete'}
  <Popup title="Delete this pack?" onclose={() => (confirm = '')}>
    <div class="form">
      <p>“{pack.name}” and its {pack.prompts.length} prompts are deleted from this device.</p>
      <Button variant="danger" onclick={deletePack}>Delete pack</Button>
      <Button variant="secondary" onclick={() => (confirm = '')}>Keep it</Button>
    </div>
  </Popup>
{/if}

<style>
  .about { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); min-height: 44px; }
  .act { flex: none; white-space: nowrap; }
  .name, .field { display: flex; flex-direction: column; gap: var(--s-1); font-weight: 600; color: var(--text-dim); }
  .count { color: var(--text-dim); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; font-family: var(--font-body); font-weight: 700; }
  .list { display: flex; flex-direction: column; align-items: flex-start; gap: var(--s-2); margin-top: var(--s-5); }
  .list .prompts { width: 100%; }
  .tip { margin: 0; color: var(--text-faint); font-size: 0.8rem; }
  .none { margin: 0 0 var(--s-3); color: var(--text-dim); }
  .prompts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  .prompt { width: 100%; min-height: var(--tap); text-align: left; padding: var(--s-2) var(--s-4); border-radius: var(--r-md); border: 1.5px solid var(--line); background: var(--surface); font-weight: 600; line-height: 1.3; }
  .stock { display: block; margin-top: 2px; font-size: 0.85rem; font-weight: 500; color: var(--text-faint); }
  .fill { display: flex; flex-direction: column; gap: var(--s-2); padding: var(--s-3); border-radius: var(--r-md); border: 1.5px dashed var(--line-strong); }
  .fill p { margin: 0; }
  .prompt:active { background: color-mix(in srgb, var(--accent) 18%, var(--surface)); }
  .form { display: flex; flex-direction: column; gap: var(--s-2); }
  .form p { margin-bottom: var(--s-2); }
  .problem { color: var(--bad-ink); font-weight: 600; }
</style>
