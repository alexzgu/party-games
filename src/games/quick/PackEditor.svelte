<script lang="ts">
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import SharedPill from '../../components/SharedPill.svelte';
  import PackActions from '../../components/PackActions.svelte';
  import Popup from '../../components/Popup.svelte';
  import ListTools from '../../components/ListTools.svelte';
  import PinnedPanel from '../../components/PinnedPanel.svelte';
  import PromptForm from './PromptForm.svelte';
  import AddMore from '../../components/AddMore.svelte';
  import { mergeOnTop } from '../../lib/addMore';
  import { afterRun, shareWizardPack } from '../../lib/library';
  import { MORE_RANGE, morePrompts } from './generate';
  import { promptKey } from './logic';
  import { tick } from 'svelte';
  import { findPrompts } from './find';
  import { matches, type SortKey } from '../../lib/listing';
  import { customQuick, quickPacks, type QuickPack } from '../../lib/content';
  import { sfx } from '../../lib/sound';

  // One pack, every prompt listed: rename, add, edit, delete. Every change saves at once. Editing
  // a built-in saves this phone's copy under the same id; "Restore original" drops it.
  let { id, onback }: { id: string; onback: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const builtin = customQuick.isBuiltin(id);
  // svelte-ignore state_referenced_locally
  const initial = quickPacks().find((p) => p.id === id) ?? null;
  let pack = $state<QuickPack | null>(initial);
  // svelte-ignore state_referenced_locally
  let edited = $state(customQuick.isEdited(id));
  let name = $state(initial?.name ?? '');
  /** Index of the prompt open in the form, 'new' for a new one, null when closed. */
  let open = $state<number | 'new' | null>(null);
  let confirm = $state<'' | 'restore' | 'delete'>('');
  let query = $state('');
  let sort = $state<SortKey>('suggested');
  /** Index of the prompt just added or changed, briefly highlighted where it landed. */
  let fresh = $state<number | null>(null);
  let list = $state<HTMLUListElement>();
  // Taps in the first 400 ms are the tail of a double tap on the screen before.
  const shownAt = performance.now();
  const shown = $derived(pack ? findPrompts(pack.prompts, query, sort) : []);

  function persist(next: QuickPack) {
    const { custom: _, ...plain } = next;
    customQuick.put($state.snapshot(plain));
    pack = next;
    edited = customQuick.isEdited(id);
  }

  function rename() {
    if (!pack) return;
    const n = name.trim().replace(/\s+/g, ' ');
    if (!n || n === pack.name) { name = pack.name; return; }
    persist({ ...pack, name: n });
  }

  function savePrompt(p: string) {
    if (!pack || open === null) return;
    // A new prompt goes first, where the player can see it landed.
    const prompts = open === 'new' ? [p, ...pack.prompts] : pack.prompts.map((q, i) => (i === open ? p : q));
    const at = open === 'new' ? 0 : open;
    persist({ ...pack, prompts });
    open = null;
    sfx.correct();
    // A prompt the search would hide clears the search, so it never vanishes on save.
    if (!matches(p, query)) query = '';
    show(at);
  }

  async function show(i: number) {
    fresh = i;
    await tick();
    list?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    setTimeout(() => { if (fresh === i) fresh = null; }, 1600);
  }

  function deletePrompt(index: number) {
    if (!pack) return;
    persist({ ...pack, prompts: pack.prompts.filter((_, i) => i !== index) });
    open = null;
  }

  /** "🧙 Add more" is open in place of the editor. */
  let adding = $state(false);
  const otherPrompts = () => quickPacks().filter((p) => p.id !== id).flatMap((p) => p.prompts);
  function addMore(kept: string[], byPass: boolean) {
    if (pack) persist(afterRun({ ...pack, prompts: mergeOnTop(pack.prompts, kept, promptKey) }, byPass, false));
    if (pack) void shareWizardPack('quick', $state.snapshot(pack), byPass);
    query = '';
    adding = false;
    sfx.correct();
  }

  function restore() {
    customQuick.restore(id);
    pack = customQuick.original(id) ?? null;
    name = pack?.name ?? '';
    edited = false;
    confirm = '';
  }

  function deletePack() {
    customQuick.remove(id);
    confirm = '';
    onback();
  }
</script>

{#if adding && pack}
  {@const p = $state.snapshot(pack)}
  <AddMore name={p.name} noun="prompts" range={MORE_RANGE} steerHint="e.g. more about food, easier"
    ask={(o) => morePrompts(p, otherPrompts(), o)} keyOf={promptKey} onadd={addMore} onclose={() => (adding = false)}>
    {#snippet item(q: string)}<span class="q">{q}</span>{/snippet}
  </AddMore>
{:else}
<Screen title={pack?.name ?? 'Pack'} {onback} fill={!!pack}>
  {#if !pack}
    <p class="muted">This pack is no longer on this phone.</p>
  {:else}
    <PinnedPanel kind="editor" label="quick-items-h" foldId="quick-details" foldName="details" foldSpoken="pack details" keep="items">
      {#snippet top()}
        {#if pack}
          <div class="about">
            <p class="muted">
              {#if builtin}Comes with the app{edited ? ' · edited on this phone' : ''}{:else if pack?.shared}<SharedPill />{:else}Your pack, on this phone only{/if}
            </p>
            {#if builtin && edited}
              <span class="act"><Button variant="secondary" size="sm" onclick={() => (confirm = 'restore')} tip="Undoes your changes and brings back the original pack">Restore original</Button></span>
            {:else if !builtin}
              <span class="act"><Button variant="ghost" size="sm" onclick={() => (confirm = 'delete')}>Delete pack</Button></span>
            {/if}
          </div>
          <PackActions game="quick" {pack} onshared={() => { if (pack) pack.shared = true; }} />

          <label class="name">
            <span>Pack name</span>
            <input type="text" bind:value={name} onchange={rename} maxlength="40" autocomplete="off" enterkeyhint="done" />
          </label>
        {/if}
      {/snippet}
      {#snippet row(toggle)}
        <ListTools key="quick:prompts" bind:query bind:sort placeholder="Search prompts" shown={shown.length} total={pack?.prompts.length}>
          {#snippet title()}
            <h3 class="count" id="quick-items-h">{pack?.prompts.length} {pack?.prompts.length === 1 ? 'prompt' : 'prompts'}</h3>
            <p class="tip">Each reads “Name 3 …”. Tap one to change it.</p>
          {/snippet}
          {#snippet extra()}{@render toggle()}{/snippet}
        </ListTools>
      {/snippet}

      {#if query && !shown.length}<p class="none">No prompts match “{query.trim()}”</p>{/if}
      <ul class="prompts" bind:this={list}>
        {#each shown as { q, i } (i)}
          <li>
            <button class="row" class:fresh={fresh === i} data-i={i} onclick={() => { if (performance.now() - shownAt >= 400) open = i; }}>{q}</button>
          </li>
        {/each}
      </ul>
    </PinnedPanel>
  {/if}

  {#snippet actions()}
    {#if pack && !builtin}<Button size="lg" variant="secondary" onclick={() => (adding = true)} tip="Fizzwick writes more; you choose which to add">🧙 Add more</Button>{/if}
    {#if pack}<Button size="lg" onclick={() => (open = 'new')} tip="Type in a new prompt yourself">+ Prompt</Button>{/if}
  {/snippet}
</Screen>
{/if}

{#if pack && open !== null}
  {@const index = open}
  <PromptForm
    prompt={index === 'new' ? null : pack.prompts[index]}
    others={pack.prompts.filter((_, i) => i !== index)}
    onsave={savePrompt}
    ondelete={index === 'new' ? undefined : () => deletePrompt(index)}
    onclose={() => (open = null)}
  />
{/if}

{#if pack && confirm === 'restore'}
  <Popup title="Restore original?" onclose={() => (confirm = '')}>
    <div class="confirm">
      <p>“{customQuick.original(id)?.name}” goes back to the prompts that came with the app. Your changes to it are lost.</p>
      <Button variant="danger" onclick={restore}>Restore original</Button>
      <Button variant="secondary" onclick={() => (confirm = '')}>Keep changes</Button>
    </div>
  </Popup>
{:else if pack && confirm === 'delete'}
  <Popup title="Delete this pack?" onclose={() => (confirm = '')}>
    <div class="confirm">
      <p>“{pack.name}” and its {pack.prompts.length} prompts are deleted from this phone.</p>
      <Button variant="danger" onclick={deletePack}>Delete pack</Button>
      <Button variant="secondary" onclick={() => (confirm = '')}>Keep it</Button>
    </div>
  </Popup>
{/if}

<style>
  .about { display: flex; align-items: center; justify-content: space-between; gap: var(--s-3); min-height: 44px; }
  .about p { margin: 0; }
  .act { flex: none; white-space: nowrap; }
  .name { display: flex; flex-direction: column; gap: var(--s-1); font-weight: 600; color: var(--text-dim); }
  .count { color: var(--text-dim); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.08em; font-family: var(--font-body); font-weight: 700; }
  .tip { margin: 0; color: var(--text-faint); font-size: 0.8rem; }
  .none { margin: 0 0 var(--s-3); color: var(--text-dim); }
  .prompts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  .row {
    width: 100%; min-height: var(--tap-md); text-align: left; padding: var(--s-2) var(--s-4); border-radius: var(--r-md);
    border: 1.5px solid var(--line); background: var(--surface); font-weight: 700; font-size: 1.05rem;
  }
  .row.fresh { animation: fresh 1.6s var(--ease-out); }
  @keyframes fresh { from { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 22%, var(--surface)); } }
  .row:active { background: color-mix(in srgb, var(--accent) 18%, var(--surface)); }
  .q { font-weight: 700; }
  .confirm { display: flex; flex-direction: column; gap: var(--s-2); }
  .confirm p { margin: 0 0 var(--s-2); }
</style>
