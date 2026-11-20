<script lang="ts">
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import ExportPack from '../../components/ExportPack.svelte';
  import Popup from '../../components/Popup.svelte';
  import ListTools from '../../components/ListTools.svelte';
  import { customSnark, snarkPacks, type SnarkPack } from '../../lib/content';
  import type { SortKey } from '../../lib/listing';
  import { sfx } from '../../lib/sound';
  import { findPrompts } from './find';

  // One pack, every prompt listed: rename, add, edit, delete; every change saves at once.
  // Editing a built-in saves this device's copy under the same id; "Restore original" drops it.
  let { id, onback }: { id: string; onback: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const builtin = customSnark.isBuiltin(id);
  // svelte-ignore state_referenced_locally
  const initial = snarkPacks().find((p) => p.id === id) ?? null;
  let pack = $state<SnarkPack | null>(initial);
  // svelte-ignore state_referenced_locally
  let edited = $state(customSnark.isEdited(id));
  let name = $state(initial?.name ?? '');
  let open = $state<number | 'new' | null>(null);
  let draft = $state('');
  let problem = $state('');
  let confirm = $state<'' | 'restore' | 'delete'>('');
  let query = $state('');
  let sort = $state<SortKey>('suggested');
  const shown = $derived(pack ? findPrompts(pack.prompts, query, sort) : []);

  function persist(next: SnarkPack) {
    const { custom: _, ...plain } = next;
    customSnark.put($state.snapshot(plain));
    pack = next;
    edited = customSnark.isEdited(id);
  }

  function rename() {
    if (!pack) return;
    const n = name.trim().replace(/\s+/g, ' ');
    if (!n || n === pack.name) { name = pack.name; return; }
    persist({ ...pack, name: n });
  }

  function edit(i: number | 'new') {
    open = i;
    draft = i === 'new' || !pack ? '' : pack.prompts[i];
    problem = '';
  }

  function save(e: SubmitEvent) {
    e.preventDefault();
    if (!pack || open === null) return;
    const text = draft.trim().replace(/\s+/g, ' ');
    if (!text) { problem = 'Type a prompt first.'; return; }
    if (pack.prompts.some((q, i) => i !== open && q.toLowerCase() === text.toLowerCase())) { problem = 'That prompt is already in this pack.'; return; }
    const prompts = open === 'new' ? [text, ...pack.prompts] : pack.prompts.map((q, i) => (i === open ? text : q));
    persist({ ...pack, prompts });
    open = null;
    query = '';
    sfx.correct();
  }

  function remove(i: number) {
    if (!pack) return;
    persist({ ...pack, prompts: pack.prompts.filter((_, k) => k !== i) });
    open = null;
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

<Screen title={pack?.name ?? 'Pack'} {onback}>
  {#if !pack}
    <p class="muted">This pack is no longer on this device.</p>
  {:else}
    <div class="about">
      <p class="muted">{#if builtin}Comes with the app{edited ? ' · edited on this device' : ''}{:else}Your pack, on this device only{/if}</p>
      {#if builtin && edited}
        <span class="act"><Button variant="secondary" size="sm" onclick={() => (confirm = 'restore')}>Restore original</Button></span>
      {:else if !builtin}
        <span class="act"><Button variant="ghost" size="sm" onclick={() => (confirm = 'delete')}>Delete pack</Button></span>
      {/if}
    </div>
    <ExportPack game="snark" {pack} />
    <label class="name">
      <span>Pack name</span>
      <input type="text" bind:value={name} onchange={rename} maxlength="40" autocomplete="off" enterkeyhint="done" />
    </label>
    <section class="list" aria-label="Prompts">
      <ListTools key="snark:prompts" bind:query bind:sort placeholder="Search prompts" shown={shown.length} total={pack.prompts.length}>
        {#snippet title()}
          <h3 class="count">{pack?.prompts.length} prompts</h3>
          <p class="tip">Tap one to change it</p>
        {/snippet}
      </ListTools>
      {#if query && !shown.length}<p class="none">No prompts match “{query.trim()}”</p>{/if}
      <ul class="prompts">
        {#each shown as { q, i } (i)}
          <li><button class="prompt" onclick={() => edit(i)}>{q}</button></li>
        {/each}
      </ul>
    </section>
  {/if}
  {#snippet actions()}
    {#if pack}<Button size="lg" onclick={() => edit('new')}>+ Add a prompt</Button>{/if}
  {/snippet}
</Screen>

{#if pack && open !== null}
  {@const index = open}
  <Popup title={index === 'new' ? 'New prompt' : 'Edit prompt'} onclose={() => (open = null)}>
    <form class="form" onsubmit={save}>
      <label class="field">
        <span>Prompt</span>
        <textarea bind:value={draft} rows="3" maxlength="140" oninput={() => (problem = '')} placeholder="A terrible name for a boat"></textarea>
      </label>
      {#if problem}<p class="problem" role="alert">{problem}</p>{/if}
      <Button type="submit">{index === 'new' ? 'Add prompt' : 'Save prompt'}</Button>
      {#if index !== 'new'}<Button variant="danger" onclick={() => remove(index)}>Delete prompt</Button>{/if}
    </form>
  </Popup>
{/if}

{#if pack && confirm === 'restore'}
  <Popup title="Restore original?" onclose={() => (confirm = '')}>
    <div class="form">
      <p>“{customSnark.original(id)?.name}” goes back to the prompts that came with the app. Your changes to it are lost.</p>
      <Button variant="danger" onclick={restore}>Restore original</Button>
      <Button variant="secondary" onclick={() => (confirm = '')}>Keep my changes</Button>
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
  .list { display: flex; flex-direction: column; }
  .tip { margin: 0; color: var(--text-faint); font-size: 0.8rem; }
  .none { margin: 0 0 var(--s-3); color: var(--text-dim); }
  .prompts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  .prompt { width: 100%; min-height: 56px; text-align: left; padding: var(--s-2) var(--s-4); border-radius: var(--r-md); border: 1.5px solid var(--line); background: var(--surface); font-weight: 600; line-height: 1.3; }
  .prompt:active { background: color-mix(in srgb, var(--accent) 18%, var(--surface)); }
  .form { display: flex; flex-direction: column; gap: var(--s-2); }
  .form p { margin-bottom: var(--s-2); }
  .problem { color: var(--bad-ink); font-weight: 600; }
</style>
