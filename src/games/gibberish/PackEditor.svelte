<script lang="ts">
  import Screen from '../../components/Screen.svelte';
  import Button from '../../components/Button.svelte';
  import ExportPack from '../../components/ExportPack.svelte';
  import Popup from '../../components/Popup.svelte';
  import ListTools from '../../components/ListTools.svelte';
  import CardForm from './CardForm.svelte';
  import AddMore from '../../components/AddMore.svelte';
  import { mergeOnTop } from '../../lib/addMore';
  import { afterRun, shareWizardPack } from '../../lib/library';
  import { MORE_RANGE, moreCards } from './generate';
  import { answerKey } from './parse';
  import { tick } from 'svelte';
  import { cardMatches, findCards } from './find';
  import type { SortKey } from '../../lib/listing';
  import { customGibberish, gibberishPacks, type GibberishCard, type GibberishPack } from '../../lib/content';
  import { sfx } from '../../lib/sound';

  // One pack, every card listed: rename, add, edit, delete. Every change saves at once. Editing
  // a built-in saves this phone's copy under the same id; "Restore original" drops it.
  let { id, onback }: { id: string; onback: () => void } = $props();

  // svelte-ignore state_referenced_locally
  const builtin = customGibberish.isBuiltin(id);
  // svelte-ignore state_referenced_locally
  const initial = gibberishPacks().find((p) => p.id === id) ?? null;
  let pack = $state<GibberishPack | null>(initial);
  // svelte-ignore state_referenced_locally
  let edited = $state(customGibberish.isEdited(id));
  let name = $state(initial?.name ?? '');
  /** Index of the card open in the form, 'new' for a new one, null when closed. */
  let open = $state<number | 'new' | null>(null);
  let confirm = $state<'' | 'restore' | 'delete'>('');
  let query = $state('');
  let sort = $state<SortKey>('suggested');
  /** Index of the card just added or changed, briefly highlighted where it landed. */
  let fresh = $state<number | null>(null);
  let list = $state<HTMLUListElement>();
  const shown = $derived(pack ? findCards(pack.cards, query, sort) : []);

  const categories = [...new Set(gibberishPacks().flatMap((p) => p.cards.map((c) => c.hint)).filter(Boolean))].sort();

  function persist(next: GibberishPack) {
    const { custom: _, ...plain } = next;
    customGibberish.put($state.snapshot(plain));
    pack = next;
    edited = customGibberish.isEdited(id);
  }

  function rename() {
    if (!pack) return;
    const n = name.trim().replace(/\s+/g, ' ');
    if (!n || n === pack.name) { name = pack.name; return; }
    persist({ ...pack, name: n });
  }

  function saveCard(card: GibberishCard) {
    if (!pack || open === null) return;
    // A new card goes first, where the player can see it landed.
    const cards = open === 'new' ? [card, ...pack.cards] : pack.cards.map((c, i) => (i === open ? card : c));
    const at = open === 'new' ? 0 : open;
    persist({ ...pack, cards });
    open = null;
    sfx.correct();
    // A card the search would hide clears the search, so it never vanishes on save.
    if (!cardMatches(card, query)) query = '';
    show(at);
  }

  async function show(i: number) {
    fresh = i;
    await tick();
    list?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    setTimeout(() => { if (fresh === i) fresh = null; }, 1600);
  }

  function deleteCard(index: number) {
    if (!pack) return;
    persist({ ...pack, cards: pack.cards.filter((_, i) => i !== index) });
    open = null;
  }

  /** "🧙 Add more" is open in place of the editor. */
  let adding = $state(false);
  const otherCards = () => gibberishPacks().filter((p) => p.id !== id).flatMap((p) => p.cards);
  function addMore(kept: GibberishCard[], byPass: boolean) {
    if (pack) persist(afterRun({ ...pack, cards: mergeOnTop(pack.cards, kept, answerKey) }, byPass, false));
    if (pack) void shareWizardPack('gibberish', $state.snapshot(pack), byPass);
    query = '';
    adding = false;
    sfx.correct();
  }

  function restore() {
    customGibberish.restore(id);
    pack = customGibberish.original(id) ?? null;
    name = pack?.name ?? '';
    edited = false;
    confirm = '';
  }

  function deletePack() {
    customGibberish.remove(id);
    confirm = '';
    onback();
  }
</script>

{#if adding && pack}
  {@const p = $state.snapshot(pack)}
  <AddMore name={p.name} noun="cards" range={MORE_RANGE} steerHint="e.g. more movies, harder"
    ask={(o) => moreCards(p, otherCards(), o)} keyOf={answerKey} onadd={addMore} onclose={() => (adding = false)}>
    {#snippet item(c: GibberishCard)}
      <span class="it">
        <span class="ph">{c.phrase}</span>
        <span class="an">→ {c.answer}</span>
        {#if c.hint}<span class="hi">{c.hint}</span>{/if}
      </span>
    {/snippet}
  </AddMore>
{:else}
<Screen title={pack?.name ?? 'Pack'} {onback}>
  {#if !pack}
    <p class="muted">This pack is no longer on this phone.</p>
  {:else}
    <div class="about">
      <p class="muted">
        {#if builtin}Comes with the app{edited ? ' · edited on this phone' : ''}{:else if pack?.shared}Your pack, shared in the Community library: edits you make here are shared too the next time Fizzwick adds to it{:else}Your pack, on this phone only{/if}
      </p>
      {#if builtin && edited}
        <span class="act"><Button variant="secondary" size="sm" onclick={() => (confirm = 'restore')}>Restore original</Button></span>
      {:else if !builtin}
        <span class="act"><Button variant="ghost" size="sm" onclick={() => (confirm = 'delete')}>Delete pack</Button></span>
      {/if}
    </div>
    <ExportPack game="gibberish" {pack} />

    <label class="name">
      <span>Pack name</span>
      <input type="text" bind:value={name} onchange={rename} maxlength="40" autocomplete="off" enterkeyhint="done" />
    </label>

    <section class="list" aria-label="Cards">
      <ListTools key="gibberish:cards" bind:query bind:sort placeholder="Search phrases, answers, categories" shown={shown.length} total={pack.cards.length}>
        {#snippet title()}
          <h3 class="count">{pack?.cards.length} {pack?.cards.length === 1 ? 'card' : 'cards'}</h3>
          <p class="tip">Tap one to change it</p>
        {/snippet}
      </ListTools>
      {#if query && !shown.length}<p class="none">No cards match “{query.trim()}”</p>{/if}
      <ul class="cards" bind:this={list}>
        {#each shown as { c, i } (i)}
          <li>
            <button class="card" class:fresh={fresh === i} data-i={i} onclick={() => (open = i)}>
              <span class="ph">{c.phrase}</span>
              <span class="an">→ {c.answer}</span>
              {#if c.hint}<span class="hi">{c.hint}</span>{/if}
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#snippet actions()}
    {#if pack && !builtin}<Button size="lg" variant="secondary" onclick={() => (adding = true)}>🧙 Add more</Button>{/if}
    {#if pack}<Button size="lg" onclick={() => (open = 'new')}>+ Add a card</Button>{/if}
  {/snippet}
</Screen>
{/if}

{#if pack && open !== null}
  {@const index = open}
  <CardForm
    card={index === 'new' ? null : pack.cards[index]}
    others={pack.cards.filter((_, i) => i !== index)}
    {categories}
    onsave={saveCard}
    ondelete={index === 'new' ? undefined : () => deleteCard(index)}
    onclose={() => (open = null)}
  />
{/if}

{#if pack && confirm === 'restore'}
  <Popup title="Restore original?" onclose={() => (confirm = '')}>
    <div class="confirm">
      <p>“{customGibberish.original(id)?.name}” goes back to the cards that came with the app. Your changes to it are lost.</p>
      <Button variant="danger" onclick={restore}>Restore original</Button>
      <Button variant="secondary" onclick={() => (confirm = '')}>Keep my changes</Button>
    </div>
  </Popup>
{:else if pack && confirm === 'delete'}
  <Popup title="Delete this pack?" onclose={() => (confirm = '')}>
    <div class="confirm">
      <p>“{pack.name}” and its {pack.cards.length} cards are deleted from this phone.</p>
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
  .list { display: flex; flex-direction: column; }
  .tip { margin: 0; color: var(--text-faint); font-size: 0.8rem; }
  .none { margin: 0 0 var(--s-3); color: var(--text-dim); }
  .cards { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--s-2); }
  .card {
    width: 100%; min-height: 64px; text-align: left; padding: var(--s-2) var(--s-4); border-radius: var(--r-md);
    border: 1.5px solid var(--line); background: var(--surface); display: flex; flex-direction: column;
  }
  .card.fresh { animation: fresh 1.6s var(--ease-out); }
  @keyframes fresh { from { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 22%, var(--surface)); } }
  .card:active { background: color-mix(in srgb, var(--accent) 18%, var(--surface)); }
  .ph { font-family: var(--font-display); font-weight: 800; font-size: 1.1rem; line-height: 1.15; }
  .an { color: var(--text-dim); font-weight: 600; }
  .hi { color: var(--text-faint); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.06em; }
  .it { display: flex; flex-direction: column; }
  .confirm { display: flex; flex-direction: column; gap: var(--s-2); }
  .confirm p { margin: 0 0 var(--s-2); }
</style>
