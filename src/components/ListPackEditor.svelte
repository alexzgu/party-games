<script lang="ts" generics="Pack extends ListPack & PackMeta">
  import type { PackGameId } from '../app.config';
  import Screen from './Screen.svelte';
  import Button from './Button.svelte';
  import SharedPill from './SharedPill.svelte';
  import PackActions from './PackActions.svelte';
  import Popup from './Popup.svelte';
  import ListTools from './ListTools.svelte';
  import PinnedPanel from './PinnedPanel.svelte';
  import Segmented from './Segmented.svelte';
  import AddMore from './AddMore.svelte';
  import type { SortKey } from '../lib/listing';
  import type { PackMeta } from '../lib/content';
  import { sfx } from '../lib/sound';
  import { afterRun, shareWizardPack } from '../lib/library';
  import { NO_ROOM, putSplit, tooLong, type AnyPack } from '../lib/packfile';
  import { addItems, editProblem, findItems, itemKey, LIST_MAX, listOf, packItems, removeItem, setItem, type ListItem, type ListPack, type ListSpec } from '../lib/listPack';
  import { moreItems, type ListWizard } from '../lib/listWizard';

  // One list pack (Doodle Brawl, Bad Hand, Sketchy), every list shown in turn: rename, add, edit,
  // delete; every change saves at once. Editing a built-in saves this device's copy under the same
  // id; "Restore original" drops it. The player's own packs get "🧙 Add more".
  interface Store {
    isBuiltin(id: string): boolean;
    isEdited(id: string): boolean;
    put(p: Pack): void;
    original(id: string): Pack | undefined;
    restore(id: string): void;
    remove(id: string): void;
  }
  let {
    game,
    id,
    specs,
    store,
    packs,
    wizard,
    moreRange,
    steerHint,
    addLabel,
    totalNoun = 'in all',
    onback,
  }: {
    game: PackGameId;
    id: string;
    specs: readonly ListSpec[];
    store: Store;
    /** Every pack of the game on this phone. */
    packs: () => Pack[];
    wizard: ListWizard;
    moreRange: { start: number; min: number; max: number; step: number };
    steerHint: string;
    /** The add button's words ("+ Card"). */
    addLabel: string;
    /** What the items of every list are called together ("cards"), for the header's total. */
    totalNoun?: string;
    onback: () => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  const builtin = store.isBuiltin(id);
  // svelte-ignore state_referenced_locally
  const initial = packs().find((p) => p.id === id) ?? null;
  let pack = $state<Pack | null>(initial);
  // svelte-ignore state_referenced_locally
  let edited = $state(store.isEdited(id));
  let name = $state(initial?.name ?? '');
  // svelte-ignore state_referenced_locally
  let open = $state<{ field: string; at: number | 'new' } | null>(null);
  let draft = $state('');
  let problem = $state('');
  let confirm = $state<'' | 'restore' | 'delete'>('');
  let query = $state('');
  /** What happened to the pack, when it needs saying (items moved to another pack, changed elsewhere). */
  let notice = $state('');
  let sort = $state<SortKey>('suggested');
  let adding = $state(false);
  const total = $derived(pack ? specs.reduce((n, s) => n + listOf(pack!, s.field).length, 0) : 0);
  const shown = $derived(pack ? specs.map((s) => ({ spec: s, found: findItems(listOf(pack!, s.field), query, sort) })) : []);
  const found = $derived(shown.reduce((n, l) => n + l.found.length, 0));
  /** The list a new item goes in (chosen in the popup when the pack has more than one). */
  let kind = $state('');
  const spec = $derived(specs.find((s) => s.field === (open?.at === 'new' ? kind : open?.field)) ?? specs[0]);
  const keyOf = $derived(itemKey(specs));
  const prefix = $derived(`${game}-items`);

  function persist(next: Pack) {
    const { custom: _, ...plain } = next;
    store.put($state.snapshot(plain) as Pack);
    pack = next;
    edited = store.isEdited(id);
  }

  /**
   * Whether the pack on screen is the one saved; when another tab changed (or deleted) it, shows
   * that one and says so. Asked before every change, so an old copy is never saved over a new one.
   */
  function upToDate(): boolean {
    const saved = packs().find((p) => p.id === id) ?? null;
    const shape = (p: Pack | null) => p && JSON.stringify([p.name, ...specs.map((s) => listOf(p, s.field))]);
    if (shape(saved) === shape(pack)) {
      pack = saved; // its marks too: another tab may have shared it
      notice = '';
      return pack !== null;
    }
    pack = saved;
    name = saved?.name ?? '';
    open = null;
    confirm = '';
    notice = 'This pack was changed in another tab. Here it is as saved; make your change again.';
    return false;
  }

  /** Saves the pack, as several when it is too long for one, and says where the rest went. */
  function saveParts(next: Pack): Pack[] {
    const saved = putSplit(game, next);
    if (!saved.length) { notice = NO_ROOM; return saved; }
    notice = '';
    pack = packs().find((p) => p.id === id) ?? null;
    if (saved.length > 1) notice = `Too long for one pack (${LIST_MAX} ${specs.length > 1 ? 'in each list' : specs[0].many} at most). The rest is in ${saved.slice(1).map((p) => `“${p.name}”`).join(' and ')}.`;
    return saved;
  }

  function split() {
    if (!pack || !upToDate()) return;
    const { custom: _, ...plain } = pack;
    saveParts($state.snapshot(plain) as Pack);
  }

  function rename() {
    if (!pack || !upToDate()) return;
    const n = name.trim().replace(/\s+/g, ' ');
    if (!n || n === pack.name) { name = pack.name; return; }
    persist({ ...pack, name: n });
  }

  function edit(field: string, at: number | 'new') {
    open = { field, at };
    kind = field;
    draft = at === 'new' || !pack ? '' : listOf(pack, field)[at];
    problem = '';
  }

  function save(e: SubmitEvent) {
    e.preventDefault();
    if (!pack || !open || !upToDate()) return;
    const text = spec.tidy(draft.trim().replace(/\s+/g, ' '));
    problem = editProblem(pack, spec, open.at, text);
    if (problem) return;
    persist(setItem(pack, spec.field, open.at, text));
    open = null;
    query = '';
    sfx.correct();
  }

  function remove(field: string, at: number) {
    if (!pack || !upToDate()) return;
    persist(removeItem(pack, field, at));
    open = null;
  }

  const others = (): ListItem[] => packs().filter((p) => p.id !== id).flatMap((p) => packItems(specs, p));
  function added(kept: ListItem[], byPass: boolean): string | void {
    // On top of the pack as saved now: Fizzwick takes a while, and another tab may have changed it.
    const now = packs().find((p) => p.id === id);
    if (!now) return 'This pack could not be found on this device, so nothing was added. It may have been deleted in another tab.';
    const marked = afterRun(addItems($state.snapshot(now) as Pack, specs, kept), byPass, false);
    const saved = saveParts(marked);
    if (!saved.length) return NO_ROOM;
    for (const p of saved) void shareWizardPack(game, p as unknown as AnyPack, byPass);
    query = '';
    adding = false;
    sfx.correct();
  }

  function restore() {
    store.restore(id);
    pack = store.original(id) ?? null;
    name = pack?.name ?? '';
    edited = false;
    confirm = '';
  }

  function deletePack() {
    store.remove(id);
    confirm = '';
    onback();
  }
</script>

{#snippet tagged(i: ListItem)}
  <span class="it">
    {#if specs.length > 1}<span class="tag">{specs.find((s) => s.field === i.field)?.one}</span>{/if}
    <span class="q">{i.text}</span>
  </span>
{/snippet}

{#if adding && pack}
  {@const p = $state.snapshot(pack) as Pack}
  <AddMore name={p.name} noun={specs[0].many} range={moreRange} {steerHint}
    ask={(o) => moreItems(wizard, p, others(), o)} {keyOf} onadd={added} onclose={() => (adding = false)}>
    {#snippet item(i: ListItem)}{@render tagged(i)}{/snippet}
  </AddMore>
{:else}
<Screen title={pack?.name ?? 'Pack'} {onback} fill={!!pack}>
  {#if !pack}
    <p class="muted">This pack is no longer on this device.</p>
  {:else}
    <PinnedPanel kind="editor" label="{prefix}-h" foldId="{game}-details" foldName="details" foldSpoken="pack details" keep="items">
      {#snippet top()}
        {#if pack}
          <div class="about">
            <p class="muted">{#if builtin}Comes with the app{edited ? ' · edited on this device' : ''}{:else if pack?.shared}<SharedPill />{:else}Your pack, on this device only{/if}</p>
            {#if builtin && edited}
              <span class="act"><Button variant="secondary" size="sm" onclick={() => (confirm = 'restore')} tip="Undoes your changes and brings back the original pack">Restore original</Button></span>
            {:else if !builtin}
              {#if tooLong(game, pack)}<span class="act"><Button variant="secondary" size="sm" onclick={split} tip="Turns this pack into smaller packs that can each be shared. Nothing is lost.">Split</Button></span>{/if}
              <span class="act"><Button variant="ghost" size="sm" onclick={() => (confirm = 'delete')}>Delete pack</Button></span>
            {/if}
          </div>
          <PackActions {game} pack={pack as unknown as AnyPack} onshared={() => { if (pack) pack.shared = true; }} />
          <label class="name">
            <span>Pack name</span>
            <input type="text" bind:value={name} onchange={rename} maxlength="40" autocomplete="off" enterkeyhint="done" />
          </label>
        {/if}
      {/snippet}
      {#snippet row(toggle)}
        <ListTools key="{game}:items" bind:query bind:sort placeholder="Search {specs.map((s) => s.many).join(' and ')}" shown={found} {total}>
          {#snippet title()}
            <h3 class="count" id="{prefix}-h">{total} {specs.length > 1 ? totalNoun : total === 1 ? specs[0].one : specs[0].many}</h3>
            <p class="tip">Tap one to change it</p>
          {/snippet}
          {#snippet extra()}{@render toggle()}{/snippet}
        </ListTools>
      {/snippet}

      {#if notice}<p class="none" role="status">{notice}</p>{/if}
      {#if query && !found}<p class="none">Nothing matches “{query.trim()}”</p>{/if}
      {#each shown as { spec: s, found: items }, n (s.field)}
        <section class="list" class:first={n === 0} aria-label={s.many}>
          {#if specs.length > 1}<h3 class="count">{listOf(pack, s.field).length} {s.many}</h3>{/if}
          <ul class="items">
            {#each items as { text, i } (i)}
              <li><button class="item" onclick={() => edit(s.field, i)}>{text}</button></li>
            {/each}
          </ul>
        </section>
      {/each}
    </PinnedPanel>
  {/if}
  {#snippet actions()}
    {#if pack && !builtin}<Button size="lg" variant="secondary" onclick={() => (adding = true)} tip="Fizzwick writes more; you choose which to add">🧙 Add more</Button>{/if}
    {#if pack}<Button size="lg" onclick={() => edit(specs[0].field, 'new')} tip="Type in a new one yourself">{addLabel}</Button>{/if}
  {/snippet}
</Screen>
{/if}

{#if pack && open}
  {@const at = open.at}
  {@const field = open.field}
  <Popup title={at === 'new' ? `New ${specs.length > 1 ? 'card' : spec.one}` : `Edit ${spec.one}`} onclose={() => (open = null)}>
    {#if at === 'new' && specs.length > 1}
      <div class="kind">
        <Segmented label="Kind" bind:value={kind} onchange={() => (problem = '')}
          options={specs.map((s) => ({ value: s.field, label: s.one.charAt(0).toUpperCase() + s.one.slice(1) }))} />
      </div>
    {/if}
    <form class="form" onsubmit={save}>
      <label class="field">
        <span>{spec.one.charAt(0).toUpperCase() + spec.one.slice(1)}</span>
        <textarea bind:value={draft} rows="3" maxlength={spec.max} oninput={() => (problem = '')} placeholder={spec.example}></textarea>
      </label>
      {#if spec.hint}<p class="hint">{spec.hint}</p>{/if}
      {#if problem}<p class="problem" role="alert">{problem}</p>{/if}
      <Button type="submit">{at === 'new' ? `Add ${spec.one}` : `Save ${spec.one}`}</Button>
      {#if at !== 'new'}<Button variant="danger" onclick={() => remove(field, at)}>Delete {spec.one}</Button>{/if}
    </form>
  </Popup>
{/if}

{#if pack && confirm === 'restore'}
  <Popup title="Restore original?" onclose={() => (confirm = '')}>
    <div class="form">
      <p>“{store.original(id)?.name}” goes back to the {specs.map((s) => s.many).join(' and ')} that came with the app. Your changes to it are lost.</p>
      <Button variant="danger" onclick={restore}>Restore original</Button>
      <Button variant="secondary" onclick={() => (confirm = '')}>Keep changes</Button>
    </div>
  </Popup>
{:else if pack && confirm === 'delete'}
  <Popup title="Delete this pack?" onclose={() => (confirm = '')}>
    <div class="form">
      <p>“{pack.name}” and everything in it are deleted from this device.</p>
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
  .list { display: flex; flex-direction: column; gap: var(--s-2); margin-top: var(--s-5); }
  .list.first { margin-top: 0; }
  .tip { margin: 0; color: var(--text-faint); font-size: 0.8rem; }
  .none { margin: 0 0 var(--s-3); color: var(--text-dim); }
  .items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  .item { width: 100%; min-height: 56px; text-align: left; padding: var(--s-2) var(--s-4); border-radius: var(--r-md); border: 1.5px solid var(--line); background: var(--surface); font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; }
  .item:active { background: color-mix(in srgb, var(--accent) 18%, var(--surface)); }
  .form { display: flex; flex-direction: column; gap: var(--s-2); }
  .form p { margin-bottom: var(--s-2); }
  .kind { margin-bottom: var(--s-3); }
  .hint { margin: 0; color: var(--text-faint); font-size: 0.88rem; }
  .problem { color: var(--bad-ink); font-weight: 600; }
  .it { display: flex; flex-direction: column; gap: 2px; text-align: left; }
  .q { font-weight: 700; }
  .tag { align-self: flex-start; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; padding: 1px 6px; border-radius: var(--r-pill); background: var(--surface-hi); color: var(--text-dim); }
</style>
