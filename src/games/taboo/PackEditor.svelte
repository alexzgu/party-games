<script lang="ts">
  // One pack's cards, editable: rename, add one card or paste many, change or delete a card.
  // Every change saves at once. A built-in pack saves as this phone's edit of it (with
  // "Restore original"); the player's own packs can be deleted and get "🧙 Add more". With no id
  // this is a new pack ("Make a pack"), saved (and ticked in setup) on its first change; it can
  // instead be asked of the wizard.
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import SharedPill from '../../components/SharedPill.svelte';
  import PackActions from '../../components/PackActions.svelte';
  import Popup from '../../components/Popup.svelte';
  import ListTools from '../../components/ListTools.svelte';
  import PinnedPanel from '../../components/PinnedPanel.svelte';
  import CardForm from './CardForm.svelte';
  import Wizard from './Wizard.svelte';
  import AddMore from '../../components/AddMore.svelte';
  import Segmented from '../../components/Segmented.svelte';
  import { hasKey } from '../../lib/claude';
  import { mergeOnTop } from '../../lib/addMore';
  import { sfx } from '../../lib/sound';
  import { customTaboo, slugify, tabooPacks, type TabooCard, type TabooPack } from '../../lib/content';
  import { matches, sorted, type SortKey } from '../../lib/listing';
  import { reveal } from '../../lib/panel';
  import { cardId, clean, parseCards } from './cards';
  import { selectPack } from './persist';
  import { MORE_RANGE, moreCards } from './generate';
  import { afterRun, shareWizardPack } from '../../lib/library';
  import { wizardBlurb } from '../../lib/wizardAsk';

  let { id, onback }: { id: string | null; onback: () => void } = $props();

  const find = (pid: string): TabooPack | undefined => tabooPacks().find((p) => p.id === pid);
  // svelte-ignore state_referenced_locally
  let pack = $state.raw<TabooPack | undefined>(id === null ? { id: '', name: 'My pack', blurb: '', cards: [] } : find(id));
  // svelte-ignore state_referenced_locally
  let name = $state(pack?.name ?? '');
  // svelte-ignore state_referenced_locally
  const builtin = id !== null && customTaboo.isBuiltin(id);
  // svelte-ignore state_referenced_locally
  let edited = $state(id !== null && customTaboo.isEdited(id));

  let editing = $state<number | null>(null);
  let confirm = $state<'restore' | 'delete' | null>(null);
  let pasting = $state(false);
  let pasteText = $state('');
  let pasteNote = $state('');
  let pasteBad = $state<{ line: string; why: string }[]>([]);
  let query = $state('');
  let sort = $state<SortKey>('suggested');
  /** The card just added, lit up briefly so it is easy to spot in any order. */
  let fresh = $state('');

  // New cards go on top, so a card's position is its age: the first is the newest.
  const rows = $derived(sorted(
    (pack?.cards ?? []).map((c, i) => ({ c, i })).filter(({ c }) => matches(`${c.word} ${c.banned.join(' ')}`, query)),
    sort, (r) => r.c.word, (r) => -r.i,
  ));

  /** A new pack's id: from its name, never one already used on this phone. */
  function newId(n: string): string {
    const base = 'my-' + slugify(n);
    const taken = new Set(tabooPacks().map((p) => p.id));
    let pid = base;
    for (let k = 2; taken.has(pid); k++) pid = `${base}-${k}`;
    return pid;
  }

  function save(next: TabooPack) {
    const { custom: _, ...plain } = next;
    const isNew = !plain.id;
    if (isNew) plain.id = newId(plain.name);
    customTaboo.put(plain);
    pack = find(plain.id);
    edited = customTaboo.isEdited(plain.id);
    if (isNew) {
      selectPack(plain.id);
      // Same address as a saved pack, without rebuilding the editor (its details stay shown).
      history.replaceState(history.state, '', '#/taboo/pack?id=' + encodeURIComponent(plain.id));
    }
  }

  /** Index of a card with the same word, ignoring `skip`; -1 when there is none. */
  const clash = (c: TabooCard, skip = -1) => pack!.cards.findIndex((x, i) => i !== skip && cardId(x) === cardId(c));

  function add(c: TabooCard): string {
    if (!pack) return '';
    if (clash(c) >= 0) return `“${c.word}” is already in this pack.`;
    save({ ...pack, cards: [c, ...pack.cards] });
    query = ''; // so the new card is never hidden by an old search
    fresh = cardId(c);
    setTimeout(() => { if (fresh === cardId(c)) fresh = ''; }, 1600);
    return '';
  }

  function change(i: number, c: TabooCard): string {
    if (!pack) return '';
    if (clash(c, i) >= 0) return `“${c.word}” is already in this pack.`;
    save({ ...pack, cards: pack.cards.map((x, j) => (j === i ? c : x)) });
    editing = null;
    return '';
  }

  function removeCard(i: number) {
    if (!pack) return;
    save({ ...pack, cards: pack.cards.filter((_, j) => j !== i) });
    editing = null;
  }

  function addPasted() {
    if (!pack) return;
    const { cards, bad } = parseCards(pasteText);
    const have = new Set(pack.cards.map(cardId));
    const added = cards.filter((c) => !have.has(cardId(c)) && (have.add(cardId(c)), true));
    const repeats = cards.length - added.length;
    if (added.length) save({ ...pack, cards: [...added.reverse(), ...pack.cards] });
    pasteBad = bad;
    pasteNote = `${added.length} added${repeats ? ` · ${repeats} already here` : ''}${bad.length ? ` · ${bad.length} skipped:` : ''}`;
    if (!bad.length) { pasteText = ''; if (added.length) pasting = false; }
    else pasteText = bad.map((b) => b.line).join('\n');
    query = '';
  }

  function rename() {
    const n = clean(name);
    if (!pack) return;
    if (!n) { name = pack.name; return; }
    if (n !== pack.name) save({ ...pack, name: n });
  }

  function restore() {
    if (id === null) return;
    customTaboo.restore(id);
    pack = find(id);
    name = pack?.name ?? '';
    edited = false;
    editing = null;
    confirm = null;
  }

  /** A new pack: typed card by card, or asked of the wizard. */
  const MODES = [{ value: 'write' as const, label: 'Write', tip: 'Type or paste your own cards' }, { value: 'claude' as const, label: '🧙 Wizard', tip: 'Fizzwick writes cards from what you ask for' }];
  let mode = $state<'write' | 'claude'>(hasKey() ? 'claude' : 'write');
  /** The wizard's cards are on screen for review: the mode switch is hidden. */
  let reviewing = $state(false);
  /** Every word on the phone except this pack's: a word is never in two packs. */
  const otherWords = () => tabooPacks().filter((p) => p.id !== pack?.id).flatMap((p) => p.cards.map((c) => c.word));

  function conjured(n: string, request: string, cards: TabooCard[], byPass: boolean) {
    if (!pack) return;
    save(afterRun({ ...pack, name: clean(n) || 'My pack', blurb: wizardBlurb(request), cards: $state.snapshot(cards) }, byPass, true));
    if (pack) void shareWizardPack('taboo', $state.snapshot(pack), byPass);
    sfx.correct();
  }

  /** "🧙 Add more" is open in place of the editor. */
  let adding = $state(false);
  function addMore(kept: TabooCard[], byPass: boolean) {
    if (pack) save(afterRun({ ...pack, cards: mergeOnTop(pack.cards, $state.snapshot(kept), cardId) }, byPass, false));
    if (pack) void shareWizardPack('taboo', $state.snapshot(pack), byPass);
    query = '';
    adding = false;
    sfx.correct();
  }

  function deletePack() {
    if (pack?.id) customTaboo.remove(pack.id);
    confirm = null;
    onback();
  }
</script>

{#if adding && pack}
  {@const p = $state.snapshot(pack)}
  <AddMore name={p.name} noun="cards" range={MORE_RANGE} steerHint="e.g. more about food, easier" accent="var(--c-taboo)"
    ask={(o) => moreCards(p, otherWords(), o)} keyOf={cardId} onadd={addMore} onclose={() => (adding = false)}>
    {#snippet item(c: TabooCard)}<span class="txt"><span class="w">{c.word}</span><span class="b">{c.banned.join(' · ')}</span></span>{/snippet}
  </AddMore>
{:else}
<Screen title={pack ? (pack.id ? pack.name : 'Make a pack') : 'Pack not found'} accent="var(--c-taboo)" {onback} fill={!!pack && !(!pack.id && mode === 'claude')}>
  {#if pack && !pack.id && !reviewing}
    <Segmented label="How to make it" options={MODES} bind:value={mode} />
  {/if}
  {#if !pack}
    <p class="muted">This pack is no longer on this phone.</p>
  {:else if !pack.id && mode === 'claude'}
    <Wizard taken={otherWords} bind:reviewing onsave={conjured} />
  {:else}
    <PinnedPanel kind="editor" label="taboo-cards-h" foldId="taboo-details" foldName="details" foldSpoken="pack details" needed={pack.cards.length === 0} keep="items">
      {#snippet top()}
        {#if pack}
          {#if pack.shared}<SharedPill />{/if}
          <label class="field">
            <span class="faint">Pack name</span>
            <input type="text" maxlength="40" autocomplete="off" bind:value={name} onchange={rename} />
          </label>
          <p class="status">
            <span>{pack.cards.length} {pack.cards.length === 1 ? 'card' : 'cards'}</span>
            {#if !builtin}<span class="tag">{pack.id ? 'yours' : 'new'}</span>{:else if edited}<span class="tag hot">edited</span>{:else}<span class="tag">built-in</span>{/if}
          </p>
          {#if pack.id}<PackActions game="taboo" {pack} onshared={() => (pack = pack && { ...pack, shared: true })} />{/if}

          <div class="add">
            <div class="add-head">
              <h3>{pasting ? 'Paste many' : 'Add a card'}</h3>
              <button class="link" onclick={() => { pasting = !pasting; pasteNote = ''; pasteBad = []; }} data-tip={pasting ? 'Type in one card at a time' : 'Add a whole list of cards at once'}>{pasting ? 'Type one' : 'Paste many'}</button>
            </div>
            {#if pasting}
              <p class="faint hint">One card per line: the word, a colon, then its five banned words split by commas. For example <i>Pizza: Cheese, Slice, Pepperoni, Italian, Delivery</i></p>
              <textarea rows="5" bind:value={pasteText} aria-label="Cards to paste, one per line" placeholder="Pizza: Cheese, Slice, Pepperoni, Italian, Delivery"></textarea>
              <Button variant="secondary" disabled={!pasteText.trim()} onclick={addPasted}>Add cards</Button>
            {:else}
              <CardForm submit="+ Add card" onsave={add} focusId="add-word" />
            {/if}
            {#if pasteNote}
              <p class="note" role="status">{pasteNote}</p>
              {#if pasteBad.length}<ul class="bad">{#each pasteBad as b, i (i)}<li><b>{b.line}</b> · {b.why}</li>{/each}</ul>{/if}
            {/if}
          </div>
          {#if pack.id && !builtin}<Button variant="secondary" onclick={() => (adding = true)} tip="Fizzwick writes more; you choose which to add">🧙 Add more</Button>{/if}
        {/if}
      {/snippet}
      {#snippet row(toggle)}
        <ListTools key="taboo:cards" bind:query bind:sort placeholder="Search cards" shown={rows.length} total={pack?.cards.length}>
          {#snippet title()}<h3 id="taboo-cards-h">Cards</h3>{/snippet}
          {#snippet extra()}{@render toggle()}{/snippet}
        </ListTools>
      {/snippet}

      <ul class="cards">
        {#each rows as { c, i } (cardId(c) + i)}
          <li class:fresh={fresh === cardId(c)} use:reveal={fresh === cardId(c)}>
            {#if editing === i}
              <div class="edit" use:reveal>
                <CardForm card={c} submit="Save" onsave={(n) => change(i, n)} oncancel={() => (editing = null)} ondelete={() => removeCard(i)} />
              </div>
            {:else}
              <button class="card" onclick={() => (editing = i)} aria-label="Edit {c.word}">
                <span class="txt"><span class="w">{c.word}</span><span class="b">{c.banned.join(' · ')}</span></span>
                <svg class="pen" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>
              </button>
            {/if}
          </li>
        {/each}
      </ul>
      {#if pack.cards.length === 0}<p class="faint">No cards yet. Add one above.</p>
      {:else if rows.length === 0}<p class="faint none">No cards match “{query.trim()}”</p>{/if}

      <!-- At the end of the cards, not pinned: neither is the page's main action. -->
      {#if builtin && edited}
        <div class="end"><Button variant="secondary" onclick={() => (confirm = 'restore')} tip="Undoes your changes and brings back the original pack">↺ Restore</Button></div>
      {:else if pack.id && !builtin}
        <div class="end"><Button variant="danger" onclick={() => (confirm = 'delete')}>Delete pack</Button></div>
      {/if}
    </PinnedPanel>
  {/if}
</Screen>
{/if}

{#if confirm === 'restore'}
  <Popup title="Restore original?" onclose={() => (confirm = null)}>
    <p class="muted">Your changes to this pack on this phone will be lost. It goes back to the {customTaboo.original(id ?? '')?.cards.length} cards it came with.</p>
    <div class="confirm">
      <Button onclick={restore}>Restore original</Button>
      <Button variant="ghost" onclick={() => (confirm = null)}>Keep changes</Button>
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
  .add { display: flex; flex-direction: column; gap: var(--s-2); padding: var(--s-3); border-radius: var(--r-md); background: var(--bg-raised); border: 1.5px dashed var(--line-strong); }
  .add-head { display: flex; align-items: center; justify-content: space-between; }
  .link { border: 0; background: transparent; color: var(--accent); font-weight: 700; min-height: 44px; padding: 0 var(--s-2); }
  .hint { font-size: 0.88rem; }
  .note { font-weight: 700; color: var(--text-dim); }
  .bad { margin: 0; padding-left: 1.2em; color: var(--bad-ink); font-size: 0.88rem; display: flex; flex-direction: column; gap: 2px; }
  .cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-1); }
  .card {
    width: 100%; display: flex; align-items: center; gap: var(--s-2);
    min-height: var(--tap); padding: var(--s-2) var(--s-3) var(--s-2) var(--s-4); border-radius: var(--r-md);
    background: var(--surface); border: 0; text-align: left; line-height: 1.2;
  }
  .card:active { background: var(--surface-hi); }
  .txt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .w { font-weight: 800; font-family: var(--font-display); font-size: 1.1rem; }
  .b { font-size: 0.85rem; color: var(--text-faint); overflow-wrap: anywhere; }
  .fresh .card { animation: fresh 1.6s ease-out; }
  @keyframes fresh { from { box-shadow: inset 0 0 0 2px var(--accent); background: color-mix(in srgb, var(--accent) 18%, var(--surface)); } }
  .none { text-align: center; padding: var(--s-2) 0; }
  .pen { flex: none; color: var(--text-faint); }
  .edit { padding: var(--s-3); border-radius: var(--r-md); background: var(--surface); border: 2px solid var(--accent); }
  .end { display: flex; flex-direction: column; margin-top: var(--s-4); }
  .confirm { display: flex; flex-direction: column; gap: var(--s-2); margin-top: var(--s-4); }
</style>
