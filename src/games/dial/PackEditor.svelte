<script lang="ts">
  // One pack's cards, editable: rename, add, change or delete a card. Every change saves at once.
  // A built-in pack saves as this phone's edit of it (with "Restore original"); the player's
  // own packs can be deleted.
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import SharedPill from '../../components/SharedPill.svelte';
  import PackActions from '../../components/PackActions.svelte';
  import Popup from '../../components/Popup.svelte';
  import ListTools from '../../components/ListTools.svelte';
  import PinnedPanel from '../../components/PinnedPanel.svelte';
  import AddMore from '../../components/AddMore.svelte';
  import { mergeOnTop } from '../../lib/addMore';
  import { afterRun, shareWizardPack } from '../../lib/library';
  import { MORE_RANGE, moreCards } from './generate';
  import { customSpectra, spectrumPacks, type Spectrum, type SpectrumPack } from '../../lib/content';
  import { matches, sorted, type SortKey } from '../../lib/listing';
  import { reveal } from '../../lib/panel';
  import { cardId } from './state';

  let { id, onback }: { id: string; onback: () => void } = $props();

  const find = (): SpectrumPack | undefined => spectrumPacks().find((p) => p.id === id);
  // svelte-ignore state_referenced_locally
  let pack = $state.raw<SpectrumPack | undefined>(find());
  // svelte-ignore state_referenced_locally
  let name = $state(pack?.name ?? '');
  // svelte-ignore state_referenced_locally
  let edited = $state(customSpectra.isEdited(id));
  // svelte-ignore state_referenced_locally
  const builtin = customSpectra.isBuiltin(id);

  let addLeft = $state('');
  let addRight = $state('');
  let addError = $state('');
  let editing = $state<number | null>(null);
  let editLeft = $state('');
  let editRight = $state('');
  let editError = $state('');
  let confirm = $state<'restore' | 'delete' | null>(null);
  let query = $state('');
  let sort = $state<SortKey>('suggested');
  /** The card just added, lit up briefly so it is easy to spot in any order. */
  let fresh = $state('');

  // New cards go on top, so a card's position is its age: the first is the newest.
  const rows = $derived(sorted(
    (pack?.cards ?? []).map((c, i) => ({ c, i })).filter(({ c }) => matches(`${c.left} ${c.right}`, query)),
    sort, (r) => r.c.left, (r) => -r.i,
  ));

  const clean = (s: string) => s.trim().replace(/\s+/g, ' ');

  function save(next: SpectrumPack) {
    const { custom: _, ...plain } = next;
    customSpectra.put(plain);
    pack = find();
    edited = customSpectra.isEdited(id);
  }

  /** Index of a card with the same two sides, ignoring `skip`; -1 when there is none. */
  const clash = (c: Spectrum, skip = -1) => pack!.cards.findIndex((x, i) => i !== skip && cardId(x) === cardId(c));

  function add(e: SubmitEvent) {
    e.preventDefault();
    const c = { left: clean(addLeft), right: clean(addRight) };
    if (!c.left || !c.right || !pack) return;
    if (clash(c) >= 0) { addError = 'That card is already in this pack.'; return; }
    save({ ...pack, cards: [c, ...pack.cards] });
    addLeft = addRight = addError = '';
    query = ''; // so the new card is never hidden by an old search
    fresh = cardId(c);
    setTimeout(() => { if (fresh === cardId(c)) fresh = ''; }, 1600);
    document.getElementById('add-left')?.focus();
  }

  function startEdit(i: number) {
    editing = i;
    editLeft = pack!.cards[i].left;
    editRight = pack!.cards[i].right;
    editError = '';
  }

  function saveEdit(e: SubmitEvent) {
    e.preventDefault();
    if (editing === null || !pack) return;
    const c = { left: clean(editLeft), right: clean(editRight) };
    if (!c.left || !c.right) return;
    if (clash(c, editing) >= 0) { editError = 'That card is already in this pack.'; return; }
    save({ ...pack, cards: pack.cards.map((x, i) => (i === editing ? c : x)) });
    editing = null;
  }

  function removeCard(i: number) {
    if (!pack) return;
    save({ ...pack, cards: pack.cards.filter((_, j) => j !== i) });
    editing = null;
  }

  function rename() {
    const n = clean(name);
    if (!pack) return;
    if (!n) { name = pack.name; return; }
    if (n !== pack.name) save({ ...pack, name: n });
  }

  /** "🧙 Add more" is open in place of the editor. */
  let adding = $state(false);
  const otherCards = () => spectrumPacks().filter((p) => p.id !== id).flatMap((p) => p.cards);
  function addMore(kept: Spectrum[], byPass: boolean) {
    if (pack) save(afterRun({ ...pack, cards: mergeOnTop(pack.cards, kept, cardId) }, byPass, false));
    if (pack) void shareWizardPack('dial', pack, byPass);
    query = '';
    adding = false;
  }

  function restore() {
    customSpectra.restore(id);
    pack = find();
    name = pack?.name ?? '';
    edited = false;
    editing = null;
    confirm = null;
  }

  function deletePack() {
    customSpectra.remove(id);
    confirm = null;
    onback();
  }
</script>

{#if adding && pack}
  {@const p = pack}
  <AddMore name={p.name} noun="cards" range={MORE_RANGE} accent="var(--c-dial)" steerHint="e.g. more about food, spicier"
    ask={(o) => moreCards(p, otherCards(), o)} keyOf={cardId} onadd={addMore} onclose={() => (adding = false)}>
    {#snippet item(c: Spectrum)}<span class="scale">{c.left} <span class="sep" aria-label="to">↔</span> {c.right}</span>{/snippet}
  </AddMore>
{:else}
<Screen title={pack ? pack.name : 'Pack not found'} accent="var(--c-dial)" {onback} fill={!!pack}>
  {#if !pack}
    <p class="muted">This pack is no longer on this phone.</p>
  {:else}
    <PinnedPanel kind="editor" label="dial-cards-h" foldId="dial-details" foldName="details" foldSpoken="pack details" needed={pack.cards.length === 0} keep="items">
      {#snippet top()}
        {#if pack?.shared}<SharedPill />{/if}
        <label class="field">
          <span class="faint">Pack name</span>
          <input type="text" maxlength="40" autocomplete="off" bind:value={name} onchange={rename} />
        </label>
        {#if pack}
          <p class="status">
            <span>{pack.cards.length} {pack.cards.length === 1 ? "card" : "cards"}</span>
            {#if !builtin}<span class="tag">yours</span>{:else if edited}<span class="tag hot">edited</span>{:else}<span class="tag">built-in</span>{/if}
          </p>
          <PackActions game="dial" {pack} onshared={() => (pack = pack && { ...pack, shared: true })} />
        {/if}

        <form class="add" onsubmit={add}>
          <div class="pair">
            <input id="add-left" type="text" maxlength="40" autocomplete="off" placeholder="Left, e.g. Cold" aria-label="New card, left side" bind:value={addLeft} oninput={() => (addError = '')} />
            <input type="text" maxlength="40" autocomplete="off" placeholder="Right, e.g. Hot" aria-label="New card, right side" bind:value={addRight} oninput={() => (addError = '')} enterkeyhint="done" />
          </div>
          <Button type="submit" variant="secondary" disabled={!clean(addLeft) || !clean(addRight)}>+ Add card</Button>
          {#if addError}<p class="err">{addError}</p>{/if}
        </form>
      {/snippet}
      {#snippet row(toggle)}
        <ListTools key="dial:cards" bind:query bind:sort placeholder="Search cards" shown={rows.length} total={pack?.cards.length}>
          {#snippet title()}<h3 id="dial-cards-h">Cards</h3>{/snippet}
          {#snippet extra()}{@render toggle()}{/snippet}
        </ListTools>
      {/snippet}

      <ul class="cards">
        {#each rows as { c, i } (cardId(c) + i)}
          <li class:fresh={fresh === cardId(c)} use:reveal={fresh === cardId(c)}>
            {#if editing === i}
              <form class="edit" onsubmit={saveEdit} use:reveal>
                <div class="pair">
                  <input type="text" maxlength="40" autocomplete="off" aria-label="Left side" bind:value={editLeft} oninput={() => (editError = '')} />
                  <input type="text" maxlength="40" autocomplete="off" aria-label="Right side" bind:value={editRight} oninput={() => (editError = '')} enterkeyhint="done" />
                </div>
                {#if editError}<p class="err">{editError}</p>{/if}
                <div class="edit-actions">
                  <Button type="submit" size="sm" disabled={!clean(editLeft) || !clean(editRight)}>Save</Button>
                  <Button variant="ghost" size="sm" onclick={() => (editing = null)}>Cancel</Button>
                  <span class="grow"></span>
                  <Button variant="danger" size="sm" onclick={() => removeCard(i)}>Delete</Button>
                </div>
              </form>
            {:else}
              <button class="card" onclick={() => startEdit(i)} aria-label="Edit {c.left} to {c.right}">
                <span class="l">{c.left}</span>
                <span class="bar" aria-hidden="true">|</span>
                <span class="r">{c.right}</span>
                <svg class="pen" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>
              </button>
            {/if}
          </li>
        {/each}
      </ul>
      {#if pack.cards.length === 0}<p class="faint">No cards yet. Add one above.</p>
      {:else if rows.length === 0}<p class="faint none">No cards match “{query.trim()}”</p>{/if}
    </PinnedPanel>
  {/if}

  {#snippet actions()}
    {#if pack && builtin && edited}
      <Button variant="secondary" onclick={() => (confirm = 'restore')} tip="Undoes your changes and brings back the original pack">↺ Restore original</Button>
    {:else if pack && !builtin}
      <Button size="lg" onclick={() => (adding = true)} tip="Fizzwick writes more; you choose which to add">🧙 Add more</Button>
      <Button variant="danger" onclick={() => (confirm = 'delete')}>Delete this pack</Button>
    {/if}
  {/snippet}
</Screen>
{/if}

{#if confirm === 'restore'}
  <Popup title="Restore original?" onclose={() => (confirm = null)}>
    <p class="muted">Your changes to this pack on this phone will be lost. It goes back to the {customSpectra.original(id)?.cards.length} cards it came with.</p>
    <div class="confirm">
      <Button onclick={restore}>Restore original</Button>
      <Button variant="ghost" onclick={() => (confirm = null)}>Keep my changes</Button>
    </div>
  </Popup>
{:else if confirm === 'delete'}
  <Popup title="Delete this pack?" onclose={() => (confirm = null)}>
    <p class="muted">“{pack?.name}” and its {pack?.cards.length} cards will be gone from this phone.</p>
    <div class="confirm">
      <Button variant="danger" onclick={deletePack}>Delete pack</Button>
      <Button variant="ghost" onclick={() => (confirm = null)}>Keep it</Button>
    </div>
  </Popup>
{/if}

<style>
  .field { display: flex; flex-direction: column; gap: var(--s-1); font-size: 0.92rem; }
  .field input { font-weight: 700; font-size: 1.1rem; }
  .status { display: flex; align-items: center; gap: var(--s-2); color: var(--text-dim); }
  .tag { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; padding: 2px 8px; border-radius: var(--r-pill); background: var(--surface-hi); color: var(--text-dim); }
  .tag.hot { background: color-mix(in srgb, var(--accent) 22%, var(--surface)); color: var(--accent); }
  .add, .edit { display: flex; flex-direction: column; gap: var(--s-2); }
  .add { padding: var(--s-3); border-radius: var(--r-md); background: var(--bg-raised); border: 1.5px dashed var(--line-strong); }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: var(--s-2); }
  .err { color: var(--c-bad); font-weight: 600; font-size: 0.92rem; }
  .cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-1); }
  .card {
    width: 100%; display: grid; grid-template-columns: 1fr auto 1fr auto; align-items: center; gap: var(--s-2);
    min-height: 52px; padding: var(--s-2) var(--s-3) var(--s-2) var(--s-4); border-radius: var(--r-md);
    background: var(--surface); border: 0; text-align: left; font-weight: 600; line-height: 1.2;
  }
  .card:active { background: var(--surface-hi); }
  .fresh .card { animation: fresh 1.6s ease-out; }
  @keyframes fresh { from { box-shadow: inset 0 0 0 2px var(--accent); background: color-mix(in srgb, var(--accent) 18%, var(--surface)); } }
  .none { text-align: center; padding: var(--s-2) 0; }
  .l { overflow-wrap: anywhere; }
  .r { overflow-wrap: anywhere; text-align: right; }
  .bar { color: var(--accent); font-weight: 800; }
  .pen { color: var(--text-faint); }
  .edit { padding: var(--s-3); border-radius: var(--r-md); background: var(--surface); border: 2px solid var(--accent); }
  .edit-actions { display: flex; align-items: center; gap: var(--s-2); }
  .scale { font-weight: 600; }
  .sep { color: var(--accent); padding: 0 2px; }
  .confirm { display: flex; flex-direction: column; gap: var(--s-2); margin-top: var(--s-4); }
</style>
